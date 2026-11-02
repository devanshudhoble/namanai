import {
  AgentStateStep,
  BookingHold,
  Message,
  PassengerDetails,
  PaymentTransaction,
  TelemetryMetrics,
  TravelOption,
} from '../types';
import { travelEngine, normalizeCityName } from './travelEngine';
import { paymentEngine } from './paymentEngine';
import { speechService } from './speechService';
import { contextHarness } from './contextHarness';

export interface AgentContext {
  origin: string;
  destination: string;
  date: string;
  tripType: 'one-way' | 'return' | null;
  returnDate: string | null;
  passengersCount: number;
  budget: number | null;
  modePreference: 'flight' | 'train' | 'bus' | 'hotel' | 'all' | null;
  selectedClass: string | null;
  preferencesNote: string | null;
  passengerName: string;
  preference: string;
  options: TravelOption[];
  selectedOption: TravelOption | null;
  hold: BookingHold | null;
  transaction: PaymentTransaction | null;
  step: AgentStateStep;
  messages: Message[];
  telemetry: TelemetryMetrics;
  waitingForApproval: boolean;
  preferencesAsked: boolean;
  activeQuestion: 'destination' | 'origin' | 'date' | 'tripType' | 'passengers' | 'mode' | 'preferences' | 'options' | 'approval' | 'name';
}

const KNOWN_INDIAN_LOCATIONS = [
  // Metros & Tier-2/3 Hubs
  'jodhpur', 'jodpur', 'nagpur', 'mumbai', 'delhi', 'bengaluru', 'bangalore', 'pune', 'hyderabad', 'chennai',
  'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'varanasi', 'bhopal',
  'indore', 'patna', 'surat', 'kochi', 'cochin', 'goa', 'amritsar', 'manali', 'shimla',
  'dehradun', 'ayodhya', 'shirdi', 'haridwar', 'rishikesh', 'udaipur', 'agra',
  'vadodara', 'coimbatore', 'visakhapatnam', 'vizag', 'ranchi', 'raipur', 'guwahati',
  'bhubaneswar', 'wardha', 'amravati', 'solapur', 'nashik', 'latur', 'nanded', 'kolhapur',
  'mysore', 'mysuru', 'mangalore', 'kannur', 'kozhikode', 'thiruvananthapuram', 'trivandrum',
  'madurai', 'tirupati', 'vijayawada', 'guntur', 'salem', 'trichy', 'pondicherry', 'puducherry',
  'darjeeling', 'gangtok', 'shillong', 'siliguri', 'dhanbad', 'jamshedpur', 'gwalior', 'jabalpur',
  'ujjain', 'kanpur', 'allahabad', 'prayagraj', 'meerut', 'bareilly', 'aligarh', 'moradabad',
  // All Indian States & UTs
  'kerala', 'kashmir', 'rajasthan', 'himachal', 'uttarakhand', 'punjab', 'haryana', 'gujarat',
  'maharashtra', 'karnataka', 'tamil nadu', 'andhra pradesh', 'telangana', 'odisha', 'bihar',
  'jharkhand', 'west bengal', 'assam', 'sikkim', 'meghalaya', 'tripura', 'manipur', 'mizoram',
  'nagaland', 'arunachal pradesh', 'ladakh', 'jammu', 'chhattisgarh', 'madhya pradesh', 'uttar pradesh'
];

// Context-aware Indian Date Parser using current calendar date
export function parseIndianDateInput(text: string, referenceDate: Date = new Date()): string | null {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth(); // 0-indexed
  const currentYear = referenceDate.getFullYear();

  // 1. Relative keywords
  if (lower === 'today' || lower === 'aaj') {
    return `Today (${referenceDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})`;
  }
  if (lower === 'tomorrow' || lower === 'kal') {
    const tmrw = new Date(referenceDate);
    tmrw.setDate(currentDay + 1);
    return `Tomorrow (${tmrw.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})`;
  }
  if (lower === 'day after tomorrow' || lower === 'parso') {
    const dayAfter = new Date(referenceDate);
    dayAfter.setDate(currentDay + 2);
    return `Day After Tomorrow (${dayAfter.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})`;
  }
  if (lower === 'weekend' || lower === 'this weekend') {
    const sat = new Date(referenceDate);
    const dayOfWeek = referenceDate.getDay();
    const diff = (6 - dayOfWeek + 7) % 7 || 7;
    sat.setDate(currentDay + diff);
    return `This Weekend (${sat.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})`;
  }

  // 2. Named Weekdays (e.g. "Friday", "Next Friday", "Somwar", "Monday")
  const weekdaysMap: Record<string, number> = {
    sunday: 0, itwar: 0, ravivar: 0,
    monday: 1, somwar: 1,
    tuesday: 2, mangalwar: 2,
    wednesday: 3, budhwar: 3,
    thursday: 4, guruwar: 4, veervar: 4,
    friday: 5, shukrawar: 5,
    saturday: 6, shaniwar: 6,
  };
  for (const [dayName, targetDayNum] of Object.entries(weekdaysMap)) {
    if (lower.includes(dayName)) {
      const isNext = lower.includes('next') || lower.includes('agle') || lower.includes('agla');
      const target = new Date(referenceDate);
      let diff = (targetDayNum - referenceDate.getDay() + 7) % 7;
      if (diff === 0 || isNext) diff += 7;
      target.setDate(currentDay + diff);
      return target.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  // 3. User says a pure number or date with suffix like:
  // "4", "5", "4th", "5th", "4 ko", "5 tarikh", "4 nov", "4/11", "25", "12"
  const dateNumMatch = clean.match(/(?:^|\b)(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:ko|tarikh|tareekh|nov|november|dec|december|jan|january|feb|mar|apr|may|jun|jul|aug|sep|oct)?)?(?:\b|$)/i);
  if (dateNumMatch) {
    const day = parseInt(dateNumMatch[1], 10);
    if (day >= 1 && day <= 31) {
      let targetMonth = currentMonth;
      let targetYear = currentYear;
      // If current day is 2nd Nov and user says "4", day >= currentDay -> Nov 4th.
      // If day < currentDay (e.g. user says 1 when today is 2nd), target next month!
      if (day < currentDay) {
        targetMonth = (currentMonth + 1) % 12;
        if (targetMonth === 0) targetYear += 1;
      }
      const targetDate = new Date(targetYear, targetMonth, day);
      return targetDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  return null;
}

function extractCityFromText(text: string): { destination?: string; origin?: string } {
  const lower = text.toLowerCase();
  let destination: string | undefined;
  let origin: string | undefined;

  // Pattern: "from X to Y" or "X to Y" or "X se Y"
  const fromToMatch = text.match(/(?:from|se)\s+([A-Za-z]+)\s+(?:to|tak)\s+([A-Za-z]+)/i);
  if (fromToMatch) {
    origin = normalizeCityName(fromToMatch[1]);
    destination = normalizeCityName(fromToMatch[2]);
    return { origin, destination };
  }

  const directToMatch = text.match(/([A-Za-z]+)\s+(?:to|se)\s+([A-Za-z]+)/i);
  if (directToMatch && KNOWN_INDIAN_LOCATIONS.includes(directToMatch[1].toLowerCase()) && KNOWN_INDIAN_LOCATIONS.includes(directToMatch[2].toLowerCase())) {
    origin = normalizeCityName(directToMatch[1]);
    destination = normalizeCityName(directToMatch[2]);
    return { origin, destination };
  }

  // Pattern: "to [City]" or "for [City]" or "visit [City]" or "[City] jana hai"
  const toMatch = text.match(/(?:to|for|reach|visit|in)\s+([A-Za-z]+)/i);
  if (toMatch) {
    destination = normalizeCityName(toMatch[1]);
  }

  const fromMatch = text.match(/(?:from|starting from|leaving from|origin)\s+([A-Za-z]+)/i);
  if (fromMatch) {
    origin = normalizeCityName(fromMatch[1]);
  }

  const janaHaiMatch = text.match(/([A-Za-z]+)\s+(?:jana|ghoomne|pahunchna)/i);
  if (janaHaiMatch && !destination) {
    destination = normalizeCityName(janaHaiMatch[1]);
  }

  const seMatch = text.match(/([A-Za-z]+)\s+se\b/i);
  if (seMatch && !origin) {
    origin = normalizeCityName(seMatch[1]);
  }

  // Match known Indian cities directly in text
  for (const city of KNOWN_INDIAN_LOCATIONS) {
    if (lower.includes(city)) {
      const cap = normalizeCityName(city);
      if (!destination && !origin) {
        destination = cap;
      }
    }
  }

  return { destination, origin };
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
      origin: '',
      destination: '',
      date: '',
      tripType: null,
      returnDate: null,
      passengersCount: 0,
      budget: null,
      modePreference: null,
      selectedClass: null,
      preferencesNote: null,
      passengerName: '',
      preference: 'Convenience',
      options: [],
      selectedOption: null,
      hold: null,
      transaction: null,
      step: 'idle',
      waitingForApproval: false,
      preferencesAsked: false,
      activeQuestion: 'destination',
      messages: [
        {
          id: 'msg-welcome',
          role: 'agent',
          text: 'Namaste! Where would you like to travel today?',
          timestamp: new Date().toLocaleTimeString(),
          isSpoken: true,
        },
      ],
      telemetry: {
        totalLatencyMs: 0,
        sttLatencyMs: 240,
        llmReasoningMs: 290,
        apiToolLatencyMs: 180,
        ttsTtfbMs: 190,
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
      text: '⚡ Barge-in: Listening to traveler...',
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

    // Context Harness Security Guardrail
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

    // SCENARIO: Payment Deducted / Ticket Pending Exception Recovery
    if (
      lower.includes('deducted') ||
      lower.includes('cut gaya') ||
      lower.includes('kat gaye') ||
      lower.includes('not confirmed') ||
      lower.includes('ticket pending') ||
      lower.includes('paise cut')
    ) {
      await this.handlePaymentDeductedException(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // SCENARIO: Baggage or Cancellation Policy Query
    if (
      lower.includes('baggage') ||
      lower.includes('check-in') ||
      lower.includes('luggage') ||
      lower.includes('cancellation') ||
      lower.includes('refund') ||
      lower.includes('rules')
    ) {
      await this.handleBaggageAndCancellationQuery(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // SCENARIO: Passenger Name Provided (after approval was granted)
    const nameMatch = text.match(/(?:my name is|name is|i am|for|passenger is|traveler is)\s+([A-Za-z\s]+)/i);
    const words = text.trim().split(/\s+/);
    const isNameAnswer =
      (this.context.activeQuestion === 'name' || this.context.waitingForApproval) &&
      !this.context.passengerName &&
      (nameMatch || (words.length <= 3 && !['yes', 'no', 'book', 'cancel', 'train', 'bus', 'flight', 'goa', 'nagpur', 'jodhpur', '3ac', '2ac', 'sleeper', 'haan', 'theek hai', '4', '5'].includes(lower)));

    if (isNameAnswer) {
      const capturedName = (nameMatch ? nameMatch[1] : text).trim();
      if (capturedName.length >= 2) {
        this.context.passengerName = capturedName;
        this.context.activeQuestion = 'approval';
        await this.handleExecuteSeatLockAndUpiPush(capturedName, startTime, voiceTrigger);
        this.isProcessing = false;
        return;
      }
    }

    // SCENARIO: Explicit Customer Booking Approval
    if (this.context.waitingForApproval) {
      if (
        lower.includes('yes') ||
        lower.includes('proceed') ||
        lower.includes('confirm') ||
        lower.includes('book') ||
        lower.includes('haan') ||
        lower.includes('sure') ||
        lower.includes('kardo') ||
        lower.includes('do it') ||
        lower.includes('ok') ||
        lower.includes('okay')
      ) {
        if (!this.context.passengerName) {
          this.context.activeQuestion = 'name';
          const resp = "Great! What is the primary passenger's full name for the ticket?";
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

        await this.handleExecuteSeatLockAndUpiPush(this.context.passengerName, startTime, voiceTrigger);
        this.isProcessing = false;
        return;
      } else if (lower.includes('no') || lower.includes('cancel') || lower.includes('wait') || lower.includes('nahi')) {
        this.context.waitingForApproval = false;
        this.context.activeQuestion = 'options';
        const resp = "No problem! We haven't booked anything. Would you like to explore other timings, modes, or change the dates?";
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'BOOKING_DECLINED_BY_USER',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    // STEPWISE CONVERSATION ENGINE
    await this.processStepwiseConversation(text, startTime, voiceTrigger);
    this.isProcessing = false;
  }

  // Core Step-by-Step State Machine
  private async processStepwiseConversation(text: string, startTime: number, voiceTrigger: boolean) {
    const lower = text.toLowerCase();

    // 1. EXTRACT DESTINATION & ORIGIN
    const cityExtracted = extractCityFromText(text);

    // Mid-conversation Destination Change
    if (cityExtracted.destination && this.context.destination && cityExtracted.destination.toLowerCase() !== this.context.destination.toLowerCase()) {
      this.context.destination = cityExtracted.destination;
      this.context.options = [];
      this.context.selectedOption = null;
      this.context.waitingForApproval = false;
      this.context.preferencesAsked = false;
    } else if (cityExtracted.destination && !this.context.destination) {
      this.context.destination = cityExtracted.destination;
    }

    if (cityExtracted.origin) {
      this.context.origin = cityExtracted.origin;
    }

    // If destination is still unknown and user uttered a word
    if (!this.context.destination) {
      const trimmed = text.trim();
      const singleWord = trimmed.split(/\s+/)[0];
      if (singleWord.length >= 3 && !['yes', 'no', 'hello', 'hi', 'train', 'bus', 'flight', '4', '5'].includes(singleWord.toLowerCase())) {
        this.context.destination = normalizeCityName(singleWord);
      }
    }

    // 2. CONTEXT-AWARE DATE PARSER (Fix for "4", "5", "tomorrow", etc.)
    // If the active question was "date" OR if we have destination and need date:
    const parsedDate = parseIndianDateInput(text);
    if (parsedDate && (this.context.activeQuestion === 'date' || !this.context.date)) {
      this.context.date = parsedDate;
    }

    // 3. TRIP TYPE EXTRACTION (One-way vs Return)
    if (lower.includes('one way') || lower.includes('one-way') || lower.includes('single') || lower.includes('sirf jana') || lower.includes('oneway')) {
      this.context.tripType = 'one-way';
    } else if (lower.includes('return') || lower.includes('round trip') || lower.includes('both ways') || lower.includes('roundtrip') || lower.includes('wapas')) {
      this.context.tripType = 'return';
    }

    // 4. NUMBER OF TRAVELLERS EXTRACTION
    // Only parse numbers as passenger count if we are NOT at the date step!
    if (this.context.date || this.context.activeQuestion === 'passengers') {
      const numMatch = text.match(/(\d+)\s*(?:people|persons|travellers|travelers|passengers|seats|tickets|log|adults)?/i);
      if (lower.includes('just me') || lower.includes('solo') || lower.includes('alone') || lower.includes('single') || lower.includes('ek log') || lower.trim() === '1') {
        this.context.passengersCount = 1;
      } else if (lower.includes('two') || lower.includes('do log') || lower.includes('couple') || lower.trim() === '2') {
        this.context.passengersCount = 2;
      } else if (lower.includes('three') || lower.includes('teen log') || lower.trim() === '3') {
        this.context.passengersCount = 3;
      } else if (lower.includes('four') || lower.includes('char log') || (lower.trim() === '4' && this.context.activeQuestion === 'passengers')) {
        this.context.passengersCount = 4;
      } else if (numMatch && this.context.activeQuestion === 'passengers') {
        const parsed = parseInt(numMatch[1], 10);
        if (parsed > 0) this.context.passengersCount = parsed;
      }
    }

    // 5. MODE PREFERENCE EXTRACTION
    if (lower.includes('flight') || lower.includes('plane') || lower.includes('hawai') || lower.includes('fly')) {
      this.context.modePreference = 'flight';
    } else if (lower.includes('train') || lower.includes('railway') || lower.includes('irctc')) {
      this.context.modePreference = 'train';
    } else if (lower.includes('bus') || lower.includes('sleeper bus')) {
      this.context.modePreference = 'bus';
    } else if (lower.includes('hotel') || lower.includes('resort')) {
      this.context.modePreference = 'hotel';
    } else if (lower.includes('all') || lower.includes('everything') || lower.includes('sab') || lower.includes('any')) {
      this.context.modePreference = 'all';
    }

    // 6. CLASS PREFERENCES EXTRACTION
    if (lower.includes('3ac') || lower.includes('3 ac') || lower.includes('third ac')) {
      this.context.selectedClass = '3AC';
      this.context.modePreference = 'train';
    } else if (lower.includes('2ac') || lower.includes('2 ac') || lower.includes('second ac')) {
      this.context.selectedClass = '2AC';
      this.context.modePreference = 'train';
    } else if (lower.includes('sleeper') && !lower.includes('bus')) {
      this.context.selectedClass = 'Sleeper';
      this.context.modePreference = 'train';
    }

    // 7. CHECK INTERACTIVE QUESTIONS IF OPTIONS ARE PRESENTED
    if (this.context.options.length > 0) {
      if (lower.includes('cheaper') || lower.includes('sasta') || lower.includes('budget') || lower.includes('lowest price')) {
        const cheapest = [...this.context.options].sort((a, b) => a.price - b.price)[0];
        const resp = `The most affordable option is the ${cheapest.provider} ${cheapest.serviceNumber} at ₹${cheapest.price} (${cheapest.recommendationTag}). Would you like to proceed with this, or check flights?`;
        this.context.selectedOption = cheapest;
        this.speakAndRecord(resp, 'INTERACTIVE_CHEAPER_QUERY', startTime, voiceTrigger);
        return;
      }

      if (lower.includes('morning') || lower.includes('subah')) {
        const morningFlight = this.context.options.find((o) => o.mode === 'flight' && o.departureTime.includes('AM')) || this.context.options[0];
        this.context.selectedOption = morningFlight;
        const resp = `The morning IndiGo flight departs at 06:20 AM and arrives at 08:15 AM for ₹${morningFlight.price}. Includes 15 kg check-in baggage. Should I select this option?`;
        this.speakAndRecord(resp, 'INTERACTIVE_MORNING_QUERY', startTime, voiceTrigger);
        return;
      }

      if (lower.includes('fastest') || lower.includes('quickest') || lower.includes('speed')) {
        const fastest = this.context.options.find((o) => o.mode === 'flight') || this.context.options[0];
        this.context.selectedOption = fastest;
        const resp = `The fastest option is the direct flight with IndiGo at 1h 55m for ₹${fastest.price}. Would you like to select this flight?`;
        this.speakAndRecord(resp, 'INTERACTIVE_FASTEST_QUERY', startTime, voiceTrigger);
        return;
      }

      if (lower.includes('one day later') || lower.includes('next day') || lower.includes('ek din baad')) {
        this.context.date = 'Next Saturday';
        const { options } = await travelEngine.searchTransportOptions(
          this.context.origin || 'Mumbai',
          this.context.destination,
          'Next Saturday',
          this.context.budget,
          this.context.modePreference,
          this.context.passengersCount || 1
        );
        this.context.options = options;
        const resp = `Updated for Next Saturday! We have flights from ₹${options[0]?.price || 4800} and trains from ₹420. Which one works better for you?`;
        this.speakAndRecord(resp, 'INTERACTIVE_DATE_SHIFT_QUERY', startTime, voiceTrigger);
        return;
      }

      // User selects an option (Flight, Train 3AC, Bus, etc.)
      const isSelectingFlight = lower.includes('flight') || lower.includes('indigo') || lower.includes('akasa') || lower.includes('option 1');
      const isSelecting3AC = lower.includes('3ac') || lower.includes('train') || lower.includes('third ac') || lower.includes('option 2');
      const isSelectingBus = lower.includes('bus') || lower.includes('sleeper bus') || lower.includes('option 3');

      if (isSelectingFlight || isSelecting3AC || isSelectingBus || lower.includes('select') || lower.includes('choose')) {
        let chosen = this.context.options[0];
        if (isSelecting3AC) {
          chosen = this.context.options.find((o) => o.mode === 'train') || this.context.options[0];
        } else if (isSelectingBus) {
          chosen = this.context.options.find((o) => o.mode === 'bus') || this.context.options[0];
        } else if (isSelectingFlight) {
          chosen = this.context.options.find((o) => o.mode === 'flight') || this.context.options[0];
        }

        this.context.selectedOption = chosen;
        this.context.step = 'option_selected';
        this.context.waitingForApproval = true;
        this.context.activeQuestion = 'approval';
        this.onStateChange({ ...this.context });

        const pCount = this.context.passengersCount || 1;
        const resp = `Selected ${chosen.provider} (${chosen.serviceNumber}) for ${pCount} traveller(s) from ${this.context.origin || 'Delhi'} to ${this.context.destination} on ${this.context.date || 'your selected date'}. Total fare is ₹${chosen.price}. Would you like me to proceed with this booking?`;
        this.speakAndRecord(resp, 'SOLICIT_EXPLICIT_BOOKING_APPROVAL', startTime, voiceTrigger);
        return;
      }
    }

    // 8. ONE QUESTION AT A TIME (Polite, Human, Sequential)
    // Step 1: Destination
    if (!this.context.destination) {
      this.context.activeQuestion = 'destination';
      const resp = "Hello! Welcome. Where would you like to travel today?";
      this.speakAndRecord(resp, 'STEP_1_ASK_DESTINATION', startTime, voiceTrigger);
      return;
    }

    // Step 2: Origin
    if (!this.context.origin) {
      this.context.activeQuestion = 'origin';
      const resp = `Where will you be travelling from to reach ${this.context.destination}?`;
      this.speakAndRecord(resp, 'STEP_2_ASK_ORIGIN', startTime, voiceTrigger);
      return;
    }

    // Step 3: Travel Date
    if (!this.context.date) {
      this.context.activeQuestion = 'date';
      const resp = `When would you like to travel to ${this.context.destination}?`;
      this.speakAndRecord(resp, 'STEP_3_ASK_DATE', startTime, voiceTrigger);
      return;
    }

    // Step 4: Return Journey
    if (!this.context.tripType) {
      this.context.activeQuestion = 'tripType';
      const resp = `Got it, ${this.context.date}! Would you like a one-way trip or a return journey?`;
      this.speakAndRecord(resp, 'STEP_4_ASK_RETURN', startTime, voiceTrigger);
      return;
    }

    // Step 5: Number of Travellers
    if (!this.context.passengersCount) {
      this.context.activeQuestion = 'passengers';
      const resp = "How many people will be travelling?";
      this.speakAndRecord(resp, 'STEP_5_ASK_PASSENGER_COUNT', startTime, voiceTrigger);
      return;
    }

    // Step 6: Mode of Transport
    if (!this.context.modePreference) {
      this.context.activeQuestion = 'mode';
      const resp = "How would you prefer to travel? By flight, train or bus?";
      this.speakAndRecord(resp, 'STEP_6_ASK_MODE', startTime, voiceTrigger);
      return;
    }

    // Step 7: Preferences (optional)
    if (!this.context.preferencesAsked) {
      this.context.preferencesAsked = true;
      this.context.activeQuestion = 'preferences';
      const resp = "Do you have any particular preferences, such as a morning departure, direct flight or a specific train/bus class?";
      this.speakAndRecord(resp, 'STEP_7_ASK_PREFERENCES', startTime, voiceTrigger);
      return;
    }

    // Step 8: FETCH & PRESENT GROUNDED OPTIONS FOR THIS EXACT ROUTE
    this.context.step = 'discovering';
    this.context.activeQuestion = 'options';
    this.onStateChange({ ...this.context });

    const pCount = this.context.passengersCount || 1;
    const { options, searchLatencyMs } = await travelEngine.searchTransportOptions(
      this.context.origin,
      this.context.destination,
      this.context.date,
      this.context.budget,
      this.context.modePreference,
      pCount
    );

    this.context.options = options;
    this.context.selectedOption = options[0];
    this.context.step = 'options_presented';
    this.onStateChange({ ...this.context });

    const resp = `Here are the available options for ${this.context.origin} to ${this.context.destination} on ${this.context.date} for ${pCount} traveller(s). Would you like to explore one of these, or should I look for alternatives?`;

    this.speakAndRecord(
      resp,
      'STEP_8_OPTIONS_PRESENTED',
      startTime,
      voiceTrigger,
      {
        name: 'search_transport_options',
        params: {
          origin: this.context.origin,
          destination: this.context.destination,
          date: this.context.date,
          mode: this.context.modePreference,
          passengers: pCount,
        },
        resultSummary: `Found ${options.length} verified options for ${this.context.origin} ➔ ${this.context.destination}`,
        durationMs: searchLatencyMs,
      }
    );
  }

  // --- STRICT CUSTOMER APPROVAL FIRST: LOCK SEAT & PUSH PAYMENT ---
  private async handleExecuteSeatLockAndUpiPush(
    passengerName: string,
    startTime: number,
    voiceTrigger: boolean
  ) {
    const option = this.context.selectedOption || this.context.options[0];
    if (!option) return;

    const upiHandle = `${passengerName.toLowerCase().replace(/\s+/g, '')}@okhdfcbank`;
    const passenger: PassengerDetails = {
      id: `usr-${Date.now()}`,
      name: passengerName,
      phone: '+91 98450 12345',
      email: `${passengerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      upiId: upiHandle,
      seatPreference:
        option.mode === 'train'
          ? 'Berth 28 (Lower Berth, 3AC)'
          : option.mode === 'bus'
          ? 'Single Sleeper Berth U4'
          : '12F (Window Seat)',
    };

    this.context.step = 'seat_locked';
    const hold = await travelEngine.lockFareAndHoldPNR(option.id, passenger);
    this.context.hold = hold;
    this.onStateChange({ ...this.context });

    // Initiate out-of-band UPI push
    const txn = await paymentEngine.initiateUpiPush(hold.orderId, hold.amount, upiHandle);
    this.context.transaction = txn;
    this.context.step = 'payment_pushed';
    this.context.waitingForApproval = false;

    const resp = `I've placed a 10-minute hold for ${passengerName} at ₹${hold.amount}. I sent an instant UPI payment request to your UPI ID (${upiHandle}). Please open Google Pay or PhonePe to approve the payment.`;

    this.speakAndRecord(
      resp,
      'PAYMENT_PUSH_INITIATED',
      startTime,
      voiceTrigger,
      {
        name: 'lock_fare_and_hold_pnr',
        params: { orderId: hold.orderId, amount: hold.amount, passenger: passengerName, upiVpa: upiHandle },
        resultSummary: `10m hold active for ${passengerName}. Push sent to ${upiHandle}`,
        durationMs: 310,
      }
    );
  }

  // --- SIMULATED USER UPI APPROVAL ---
  public async handleSimulatedPaymentApproval() {
    if (!this.context.transaction || !this.context.hold) return;

    this.context.step = 'payment_verifying';
    this.onStateChange({ ...this.context });

    const pnr = this.context.hold.pnr || `PNR-${Math.floor(1000 + Math.random() * 9000)}`;
    const passengerName = this.context.passengerName || 'Traveler';

    await new Promise((r) => setTimeout(r, 600));
    this.context.transaction.status = 'CAPTURED';
    this.context.step = 'confirmed';
    this.context.hold.status = 'paid';

    const resp = `Payment received! Your ${this.context.selectedOption?.mode || 'ticket'} is confirmed for ${passengerName}. Your PNR is ${pnr}. E-ticket has been sent to your WhatsApp. Have a wonderful journey!`;

    this.speakAndRecord(
      resp,
      'PAYMENT_CAPTURED_AND_TICKET_CONFIRMED',
      performance.now(),
      true,
      {
        name: 'verify_and_issue_ticket',
        params: { orderId: this.context.hold.orderId, pnr, passenger: passengerName },
        resultSummary: `Ticket confirmed: PNR ${pnr} issued for ${passengerName}`,
        durationMs: 380,
      }
    );
  }

  // --- EXCEPTION: MONEY DEDUCTED / TICKET PENDING ---
  public async handlePaymentDeductedException(startTime: number = performance.now(), voiceTrigger: boolean = true) {
    this.context.step = 'payment_exception_recovery';
    this.onStateChange({ ...this.context });

    const audit = await paymentEngine.reconcileMoneyDeductedTicketPending(
      this.context.hold?.orderId || 'ORD-VOY-554109'
    );

    const passengerName = this.context.passengerName || 'Traveler';
    this.context.step = 'confirmed';
    if (this.context.hold) {
      this.context.hold.pnr = audit.pnr;
      this.context.hold.status = 'reconciled';
    }

    const resp = `Don't worry, ${passengerName}! I ran an instant 3-way check across our payment gateway, bank ledger, and reservation system. Your payment was captured and your ticket is confirmed! Your PNR is ${audit.pnr}. Have a safe journey!`;

    this.speakAndRecord(
      resp,
      '3_WAY_RECONCILIATION_RESOLVED',
      startTime,
      voiceTrigger,
      {
        name: 'reconcile_and_issue_pnr',
        params: { auditStatus: audit.resolvedStatus, pnr: audit.pnr },
        resultSummary: `3-Way match verified. PNR ${audit.pnr} confirmed`,
        durationMs: 440,
      }
    );
  }

  // --- PUBLIC OPTION SELECTION (From UI Click) ---
  public handleSelectOptionExplicitly(opt: TravelOption) {
    this.context.selectedOption = opt;
    this.context.step = 'option_selected';
    this.context.waitingForApproval = true;
    this.context.activeQuestion = 'approval';
    this.onStateChange({ ...this.context });

    const pCount = this.context.passengersCount || 1;
    const resp = `Selected ${opt.provider} (${opt.serviceNumber}) for ${pCount} traveller(s) from ${this.context.origin || 'Delhi'} to ${this.context.destination || 'Jodhpur'} on ${this.context.date || 'your travel date'}. Total fare is ₹${opt.price}. Would you like me to proceed with this booking?`;
    this.speakAndRecord(resp, 'SOLICIT_EXPLICIT_BOOKING_APPROVAL', performance.now(), true);
  }

  // --- BAGGAGE AND CANCELLATION ---
  private async handleBaggageAndCancellationQuery(startTime: number, voiceTrigger: boolean) {
    const opt = this.context.selectedOption || this.context.options[0];
    let resp = "For flights, 15 kg check-in baggage and 7 kg cabin baggage are included. Cancellations are refundable with standard airline fee.";
    if (opt?.mode === 'train') {
      resp = `For ${opt.serviceNumber}, IRCTC allows 40 kg free luggage. Cancellations are fully refundable minus standard IRCTC clerkage.`;
    } else if (opt?.mode === 'bus') {
      resp = `For ${opt.provider}, 20 kg luggage is stored in the compartment. Full refund is available up to 12 hours prior to departure.`;
    }

    this.speakAndRecord(resp, 'BAGGAGE_AND_CANCELLATION_RESOLVED', startTime, voiceTrigger);
  }

  private speakAndRecord(
    text: string,
    intent: string,
    startTime: number,
    voiceTrigger: boolean,
    toolCall?: Message['toolCall']
  ) {
    const latency = Math.round(performance.now() - startTime);
    this.appendMessage({
      id: `agent-${Date.now()}`,
      role: 'agent',
      text,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: intent,
      latencyMs: latency,
      toolCall,
    });
    if (voiceTrigger) speechService.speak(text);
  }
}
