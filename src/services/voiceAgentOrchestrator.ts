// Voice agent orchestrator.
//
// Turn pipeline:
//   utterance -> credential guard -> NLU (Gemini via harness context, rules fallback)
//             -> slot ledger -> policy/state machine -> tools (search / hold / pay / refund)
//             -> templated reply from tool facts -> grounding validator -> TTS
//
// Design choice: the LLM understands, tools decide, templates speak.
// That is what makes "never invent a fare or PNR" enforceable rather than a prompt wish.

import type {
  AgentStateStep,
  BookingHold,
  Message,
  PassengerDetails,
  PaymentTransaction,
  RefundQuote,
  RefundRecord,
  TravelOption,
} from '../types';
import { travelEngine } from './travelEngine';
import { paymentEngine, quoteRefund, FAILURE_COPY, type UpiFailureReason } from './paymentEngine';
import { speechService } from './speechService';
import { contextHarness, type JourneyStage, type SlotKey } from './contextHarness';
import { analytics } from './analytics';
import { llmUnderstand } from './agentApi';
import {
  rulesUnderstand,
  countSlots,
  formatDisplayDate,
  fromISODate,
  toISODate,
  INTENTS,
  type Understanding,
  type DialogueState,
} from './nlu';

export type ActiveQuestion = 'destination' | 'origin' | 'date' | 'passengers' | 'options' | 'approval' | 'name' | 'cancel_confirm' | 'none';

export interface AgentContext {
  origin: string;
  destination: string;
  date: string; // display
  dateISO: string | null;
  passengersCount: number;
  modePreference: 'flight' | 'train' | 'bus' | 'hotel' | 'all' | null;
  selectedClass: string | null;
  timePreference: string | null;
  budget: number | null;
  passengerName: string;
  options: TravelOption[];
  selectedOption: TravelOption | null;
  hold: BookingHold | null;
  transaction: PaymentTransaction | null;
  refundQuote: RefundQuote | null;
  refund: RefundRecord | null;
  auditTrail: string[];
  step: AgentStateStep;
  messages: Message[];
  waitingForApproval: boolean;
  activeQuestion: ActiveQuestion;
  nluSource: 'llm' | 'rules' | null;
  isThinking: boolean;
}

const WELCOME = 'Namaste! Where would you like to travel? You can say it all at once, like "Mumbai to Nagpur next Friday, 2 people, train".';

const QUESTIONS: Record<'destination' | 'origin' | 'date' | 'passengers', (c: AgentContext) => string> = {
  destination: () => 'Where would you like to go?',
  origin: (c) => `Where will you be travelling from to ${c.destination}?`,
  date: (c) => `When would you like to travel${c.destination ? ` to ${c.destination}` : ''}?`,
  passengers: () => 'How many people are travelling?',
};

const SLOT_TO_QUESTION: Record<string, 'destination' | 'origin' | 'date' | 'passengers'> = {
  destination: 'destination',
  origin: 'origin',
  dateISO: 'date',
  passengers: 'passengers',
};

function durationMinutes(d: string): number {
  const h = d.match(/(\d+)\s*h/);
  const m = d.match(/(\d+)\s*m/);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0) || 99999;
}

function departureHour(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 12;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h;
}

/** Spoken name: trains are known by name/number, flights and buses by operator + number. */
const label = (o: TravelOption) => (o.mode === 'train' ? o.serviceNumber : `${o.provider} ${o.serviceNumber}`);

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export class VoiceAgentOrchestrator {
  private context: AgentContext;
  private onStateChange: (ctx: AgentContext) => void;
  private isProcessing = false;

  constructor(onStateChange: (ctx: AgentContext) => void) {
    this.onStateChange = onStateChange;
    contextHarness.reset();
    this.context = this.initialContext();
    analytics.track('session_started');
  }

  private initialContext(): AgentContext {
    return {
      origin: '',
      destination: '',
      date: '',
      dateISO: null,
      passengersCount: 0,
      modePreference: null,
      selectedClass: null,
      timePreference: null,
      budget: null,
      passengerName: '',
      options: [],
      selectedOption: null,
      hold: null,
      transaction: null,
      refundQuote: null,
      refund: null,
      auditTrail: [],
      step: 'idle',
      waitingForApproval: false,
      activeQuestion: 'destination',
      nluSource: null,
      isThinking: false,
      messages: [{ id: 'msg-welcome', role: 'agent', text: WELCOME, timestamp: new Date().toLocaleTimeString(), isSpoken: true }],
    };
  }

  getContext() {
    return this.context;
  }

  private emit() {
    this.onStateChange({ ...this.context });
  }

  reset() {
    speechService.stopSpeaking();
    speechService.stopListening();
    travelEngine.resetInventory();
    contextHarness.reset();
    analytics.newSession();
    this.context = this.initialContext();
    analytics.track('session_started');
    this.emit();
  }

  interruptSpeech() {
    speechService.stopSpeaking();
    this.system('Barge-in: agent stopped speaking, listening to traveller');
  }

  private stage(): JourneyStage {
    const c = this.context;
    if (c.step === 'payment_exception_recovery') return 'support';
    if (c.step === 'confirmed' || c.step === 'cancellation_quoted' || c.step === 'cancelled') return 'post_booking';
    if (c.transaction && (c.step === 'payment_pushed' || c.step === 'payment_verifying')) return 'pay';
    if (c.waitingForApproval || c.activeQuestion === 'name') return 'approve';
    if (c.options.length) return 'compare';
    return 'discover';
  }

  private dialogueState(): DialogueState {
    const c = this.context;
    return {
      activeQuestion: c.activeQuestion,
      hasOptions: c.options.length > 0 && !c.hold,
      awaitingApproval: c.waitingForApproval,
      awaitingCancelConfirm: c.activeQuestion === 'cancel_confirm',
      hasConfirmedBooking: Boolean(c.hold && (c.hold.status === 'paid' || c.hold.status === 'reconciled')),
      hasPendingPayment: Boolean(c.transaction && c.transaction.status === 'PUSHED'),
      today: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // NLU: LLM first, rules fallback. Both return the same shape.
  // ---------------------------------------------------------------------------
  private async understand(text: string): Promise<Understanding> {
    const state = this.dialogueState();
    const rules = rulesUnderstand(text, state);
    const t0 = performance.now();

    const todayISO = toISODate(new Date());
    const prompt = contextHarness.buildNluContext(this.stage(), this.context.activeQuestion, this.context.messages, todayISO);
    const redacted = contextHarness.redact(text).text;
    const res = await llmUnderstand(redacted, prompt, todayISO);
    analytics.timing('nlu_ms', performance.now() - t0);

    if (res?.ok && res.understanding && INTENTS.includes(res.understanding.intent)) {
      const llm: Understanding = { ...res.understanding, slots: res.understanding.slots ?? {}, source: 'llm' };
      // Deterministic overrides where rules are provably safer than the model:
      // payment/support intents and confirmation words are high-stakes, so rules win when they fire.
      if (['payment_issue', 'payment_failed', 'approve', 'decline'].includes(rules.intent)) {
        return { ...llm, intent: rules.intent };
      }
      // Fill any slot the LLM missed but rules caught (e.g. a bare "2" to the passenger question)
      return { ...llm, slots: { ...rules.slots, ...llm.slots } };
    }
    return rules;
  }

  // ---------------------------------------------------------------------------
  // Main turn handler
  // ---------------------------------------------------------------------------
  async handleUserUtterance(text: string, voice = true) {
    if (this.isProcessing || !text.trim()) return;
    this.isProcessing = true;
    const t0 = performance.now();
    speechService.stopSpeaking();
    contextHarness.nextTurn();
    analytics.track('user_turn');

    // 1. Credential guard runs BEFORE the text is stored, logged or sent anywhere
    const guard = contextHarness.checkCredentials(text, this.stage());
    if (!guard.safe) {
      analytics.track('credential_blocked', { reason: guard.reason ?? 'unknown' });
      this.context.messages = [
        ...this.context.messages,
        { id: `user-${Date.now()}`, role: 'user', text: '•••• (hidden for your safety)', timestamp: new Date().toLocaleTimeString() },
      ];
      this.reply(
        'Please never share your UPI PIN, OTP or card number with anyone, including me. You only enter your PIN inside the UPI app.',
        'CREDENTIAL_BLOCKED',
        t0,
        voice
      );
      this.isProcessing = false;
      return;
    }

    this.append({ id: `user-${Date.now()}`, role: 'user', text, timestamp: new Date().toLocaleTimeString() });
    this.context.isThinking = true;
    this.emit();

    try {
      const u = await this.understand(text);
      this.context.nluSource = u.source;
      analytics.track('nlu_result', { source: u.source, intent: u.intent, slotsFilled: countSlots(u.slots) });
      await this.route(u, t0, voice);
    } finally {
      this.context.isThinking = false;
      analytics.timing('turn_ms', performance.now() - t0);
      this.emit();
      this.isProcessing = false;
    }
  }

  private async route(u: Understanding, t0: number, voice: boolean) {
    const c = this.context;

    switch (u.intent) {
      case 'payment_issue':
        return this.reconcile(t0, voice);
      case 'payment_failed':
        if (c.transaction?.status === 'PUSHED') return this.paymentFailed('USER_DECLINED', voice);
        return this.reply("I don't see a payment in progress right now. If money was debited, say 'money deducted' and I'll check it with the bank.", 'PAYMENT_FAILED_NO_TXN', t0, voice);
      case 'cancel_booking':
        return this.quoteCancellation(t0, voice);
      case 'ask_baggage':
      case 'ask_cancellation_policy':
        return this.policyAnswer(u.intent, t0, voice);
      case 'booking_status':
        return this.bookingStatus(t0, voice);
    }

    if (c.activeQuestion === 'cancel_confirm') {
      if (u.intent === 'approve') return this.confirmCancellation(t0, voice);
      if (u.intent === 'decline') {
        c.activeQuestion = 'none';
        c.step = 'confirmed';
        c.refundQuote = null;
        return this.reply('Okay, your booking stays as it is. Nothing has been cancelled.', 'CANCELLATION_ABORTED', t0, voice);
      }
    }

    if (c.waitingForApproval) {
      if (u.intent === 'approve') return this.onApproval(t0, voice);
      if (u.intent === 'decline') {
        c.waitingForApproval = false;
        c.activeQuestion = 'options';
        return this.reply('No problem, nothing has been booked. Want me to look at a cheaper option, a different time, or another date?', 'BOOKING_DECLINED', t0, voice);
      }
    }

    if (u.intent === 'give_name' && u.slots.passengerName) {
      c.passengerName = u.slots.passengerName;
      return this.lockAndRequestPayment(t0, voice);
    }

    // Apply slots to the ledger (single source of truth) and mirror into UI context
    const changed = this.applySlots(u);

    if (c.options.length && !c.hold) {
      if (u.intent === 'ask_cheaper') return this.pick('cheapest', t0, voice);
      if (u.intent === 'ask_fastest') return this.pick('fastest', t0, voice);
      if (u.intent === 'ask_morning') return this.pick('morning', t0, voice);
      if (u.intent === 'select_option') return this.selectFromSpeech(u, t0, voice);
      if (u.intent === 'shift_date' && c.dateISO) {
        const d = fromISODate(c.dateISO);
        d.setDate(d.getDate() + (u.dateShiftDays ?? 1));
        contextHarness.setSlot('dateISO', toISODate(d), u.source);
        this.syncFromLedger();
        return this.search(t0, voice, `Moved to ${c.date}. `);
      }
      // Trip details changed after options were shown -> search again
      if (changed.some((k) => ['destination', 'origin', 'dateISO', 'passengers', 'mode', 'travelClass'].includes(k))) {
        if (contextHarness.missingRequired().length === 0) return this.search(t0, voice, 'Updated. ');
      }
    }

    if (u.intent === 'other' && u.reply) {
      return this.reply(u.reply, 'SMALL_TALK', t0, voice);
    }

    return this.askNextOrSearch(changed, t0, voice);
  }

  private applySlots(u: Understanding): SlotKey[] {
    const s = { ...u.slots };
    delete s.passengerName;
    if (s.passengers !== undefined && (s.passengers < 1 || s.passengers > 9)) delete s.passengers;
    const changed = contextHarness.applySlots(s, u.source);
    this.syncFromLedger();
    return changed;
  }

  private syncFromLedger() {
    const c = this.context;
    const prevDest = c.destination;
    c.destination = contextHarness.getSlot<string>('destination') ?? '';
    c.origin = contextHarness.getSlot<string>('origin') ?? '';
    c.dateISO = contextHarness.getSlot<string>('dateISO') ?? null;
    c.date = c.dateISO ? formatDisplayDate(c.dateISO) : '';
    c.passengersCount = contextHarness.getSlot<number>('passengers') ?? 0;
    c.modePreference = (contextHarness.getSlot<string>('mode') as AgentContext['modePreference']) ?? null;
    c.selectedClass = contextHarness.getSlot<string>('travelClass') ?? null;
    c.timePreference = contextHarness.getSlot<string>('timePreference') ?? null;
    c.budget = contextHarness.getSlot<number>('budget') ?? null;
    if (prevDest && c.destination !== prevDest && !c.hold) {
      c.options = [];
      c.selectedOption = null;
      c.waitingForApproval = false;
    }
  }

  private async askNextOrSearch(changed: SlotKey[], t0: number, voice: boolean) {
    const c = this.context;
    const missing = contextHarness.missingRequired();
    if (missing.length === 0) {
      analytics.track('trip_details_complete');
      return this.search(t0, voice);
    }
    const q = SLOT_TO_QUESTION[missing[0]];
    c.activeQuestion = q;
    // Acknowledge what we captured this turn, so the user knows they were heard
    const acks: string[] = [];
    if (changed.includes('origin') && changed.includes('destination')) acks.push(`${c.origin} to ${c.destination}`);
    else if (changed.includes('destination')) acks.push(c.destination);
    else if (changed.includes('origin')) acks.push(`from ${c.origin}`);
    if (changed.includes('dateISO')) acks.push(c.date);
    if (changed.includes('passengers')) acks.push(`${c.passengersCount} traveller${c.passengersCount > 1 ? 's' : ''}`);
    const prefix = acks.length ? `Got it, ${acks.join(', ')}. ` : '';
    return this.reply(prefix + QUESTIONS[q](c), `ASK_${q.toUpperCase()}`, t0, voice);
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------
  private async search(t0: number, voice: boolean, prefix = '') {
    const c = this.context;
    // A cancelled / refunded booking is history: start a fresh search on the same trip details
    if (c.hold && (c.hold.status === 'cancelled' || c.hold.status === 'refunded')) {
      c.hold = null;
      c.transaction = null;
      c.refund = null;
      c.refundQuote = null;
      c.auditTrail = [];
    }
    c.step = 'discovering';
    this.emit();
    const tTool = performance.now();
    const { options } = await travelEngine.searchTransportOptions(
      c.origin,
      c.destination,
      c.date,
      c.budget,
      c.modePreference ?? 'all',
      c.passengersCount || 1
    );
    const toolMs = performance.now() - tTool;
    analytics.timing('tool_ms', toolMs);

    let ranked = options;
    if (c.selectedClass) {
      const cls = c.selectedClass.toLowerCase();
      ranked = [...options].sort((a, b) => Number(b.serviceNumber.toLowerCase().includes(cls) || b.recommendationTag?.toLowerCase().includes(cls)) - Number(a.serviceNumber.toLowerCase().includes(cls) || a.recommendationTag?.toLowerCase().includes(cls)));
    }
    if (c.timePreference === 'morning') ranked = [...ranked].sort((a, b) => Number(departureHour(b.departureTime) < 12) - Number(departureHour(a.departureTime) < 12));

    c.options = ranked;
    c.selectedOption = null;
    c.step = 'options_presented';
    c.activeQuestion = 'options';
    contextHarness.recordOptions(ranked);
    analytics.track('options_shown', { count: ranked.length });

    if (!ranked.length) {
      return this.reply(`${prefix}I couldn't find options for that. Want me to try another mode or date?`, 'NO_OPTIONS', t0, voice);
    }
    const cheapest = [...ranked].sort((a, b) => a.price - b.price)[0];
    const fastest = [...ranked].filter((o) => o.mode !== 'hotel').sort((a, b) => durationMinutes(a.duration) - durationMinutes(b.duration))[0];
    const pax = c.passengersCount || 1;
    const parts = [`${prefix}I found ${ranked.length} options from ${c.origin} to ${c.destination} on ${c.date} for ${pax} traveller${pax > 1 ? 's' : ''}.`];
    if (fastest) parts.push(`Fastest is ${label(fastest)} at ${fastest.duration.split(' (')[0]} for ${inr(fastest.price)}.`);
    if (cheapest && cheapest.id !== fastest?.id) parts.push(`Cheapest is ${label(cheapest)} for ${inr(cheapest.price)}.`);
    parts.push('Which one should I book?');
    return this.reply(parts.join(' '), 'OPTIONS_PRESENTED', t0, voice, {
      name: 'search_transport_options',
      params: { origin: c.origin, destination: c.destination, date: c.dateISO, mode: c.modePreference ?? 'all', passengers: pax },
      resultSummary: `${ranked.length} options (sandbox inventory)`,
      durationMs: Math.round(toolMs),
    });
  }

  private pick(kind: 'cheapest' | 'fastest' | 'morning', t0: number, voice: boolean) {
    const c = this.context;
    const travel = c.options.filter((o) => o.mode !== 'hotel');
    let chosen: TravelOption | undefined;
    if (kind === 'cheapest') chosen = [...travel].sort((a, b) => a.price - b.price)[0];
    if (kind === 'fastest') chosen = [...travel].sort((a, b) => durationMinutes(a.duration) - durationMinutes(b.duration))[0];
    if (kind === 'morning') chosen = [...travel].filter((o) => departureHour(o.departureTime) < 12).sort((a, b) => departureHour(a.departureTime) - departureHour(b.departureTime))[0];
    if (!chosen) return this.reply(`I don't see a ${kind} option on this route. Want me to change the date or mode?`, `PICK_${kind.toUpperCase()}_NONE`, t0, voice);
    return this.proposeSelection(chosen, `The ${kind} option is`, t0, voice);
  }

  private selectFromSpeech(u: Understanding, t0: number, voice: boolean) {
    const c = this.context;
    let chosen: TravelOption | undefined;
    const pool = u.selection?.mode ? c.options.filter((o) => o.mode === u.selection!.mode) : c.options;
    if (u.selection?.index) chosen = pool[u.selection.index - 1];
    if (!chosen && c.selectedClass) chosen = pool.find((o) => `${o.serviceNumber} ${o.recommendationTag}`.toLowerCase().includes(c.selectedClass!.toLowerCase()));
    if (!chosen) chosen = pool[0];
    if (!chosen) return this.reply("Sorry, I couldn't match that to an option on screen. You can say 'option 2' or 'the train'.", 'SELECT_UNMATCHED', t0, voice);
    return this.proposeSelection(chosen, 'You picked', t0, voice);
  }

  /** Called from UI click as well as voice. */
  handleSelectOptionExplicitly(opt: TravelOption) {
    this.proposeSelection(opt, 'You picked', performance.now(), true);
  }

  private proposeSelection(opt: TravelOption, lead: string, t0: number, voice: boolean) {
    const c = this.context;
    c.selectedOption = opt;
    c.step = 'option_selected';
    c.waitingForApproval = true;
    c.activeQuestion = 'approval';
    analytics.track('option_selected', { mode: opt.mode, price: opt.price });
    const pax = c.passengersCount || 1;
    const text =
      `${lead} ${label(opt)}, departing ${opt.departureTime}, ${opt.duration.split(' (')[0]}. ` +
      `Total for ${pax} traveller${pax > 1 ? 's' : ''} is ${inr(opt.price)}, one-way on ${c.date}. ` +
      `Cancellation: ${opt.cancellation.refundSummary.toLowerCase()}. Shall I book it?`;
    this.reply(text, 'SOLICIT_EXPLICIT_APPROVAL', t0, voice);
  }

  private onApproval(t0: number, voice: boolean) {
    const c = this.context;
    analytics.track('booking_approved');
    c.waitingForApproval = false;
    // A failed payment on a still-valid hold is retried on the SAME order (idempotent), not re-booked
    if (c.hold && c.hold.status === 'held' && c.transaction?.status === 'FAILED') {
      return this.retryPayment(voice);
    }
    if (!c.passengerName) {
      c.activeQuestion = 'name';
      return this.reply("Great. What is the lead passenger's full name, as on their ID?", 'ASK_PASSENGER_NAME', t0, voice);
    }
    return this.lockAndRequestPayment(t0, voice);
  }

  private async lockAndRequestPayment(t0: number, voice: boolean) {
    const c = this.context;
    const option = c.selectedOption;
    if (!option) return this.askNextOrSearch([], t0, voice);
    const handle = `${c.passengerName.toLowerCase().replace(/[^a-z]/g, '') || 'traveller'}@paytm`;
    const passenger: PassengerDetails = {
      id: `usr-${Date.now()}`,
      name: c.passengerName,
      phone: '+91 9XXXX XXXXX',
      email: 'traveller@example.com',
      upiId: handle,
      seatPreference: option.mode === 'train' ? 'Lower berth (preference)' : option.mode === 'bus' ? 'Single sleeper (preference)' : 'Window (preference)',
    };
    c.step = 'seat_locked';
    this.emit();
    const tTool = performance.now();
    const hold = await travelEngine.lockFareAndHoldPNR(option.id, passenger, c.passengersCount || 1, c.dateISO);
    const txn = await paymentEngine.requestPayment(hold.orderId, hold.amount, handle);
    analytics.timing('tool_ms', performance.now() - tTool);
    c.hold = hold;
    c.transaction = txn;
    c.step = 'payment_pushed';
    c.activeQuestion = 'none';
    contextHarness.recordHold(hold);
    contextHarness.recordPayment(txn);
    analytics.track('payment_requested', { amount: hold.amount });
    return this.reply(
      `Done. Your fare is held for 10 minutes at ${inr(hold.amount)}. Please approve the payment on the Paytm UPI screen. You'll enter your PIN there, never with me.`,
      'PAYMENT_REQUESTED',
      t0,
      voice,
      {
        name: 'lock_fare_and_request_upi',
        params: { orderId: hold.orderId, amount: hold.amount, method: 'PAYTM_UPI_INTENT' },
        resultSummary: `Hold ${hold.orderId} active for 10 min`,
        durationMs: Math.round(performance.now() - tTool),
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Payment outcomes (triggered from the sandbox UPI sheet)
  // ---------------------------------------------------------------------------
  async handleSimulatedPaymentApproval() {
    const c = this.context;
    if (!c.transaction || !c.hold) return;
    c.step = 'payment_verifying';
    this.emit();
    const txn = await paymentEngine.approve(c.transaction.transactionId);
    travelEngine.confirmHold(c.hold.orderId);
    c.transaction = { ...txn };
    c.hold = { ...c.hold, status: 'paid' };
    c.step = 'confirmed';
    contextHarness.recordHold(c.hold);
    contextHarness.recordPayment(txn);
    analytics.track('booking_confirmed', { amount: c.hold.amount, mode: c.hold.selectedOption.mode });
    this.reply(
      `Payment received. Your booking is confirmed, PNR ${c.hold.pnr}. The e-ticket is in My Trips. Have a great journey, ${c.passengerName}!`,
      'BOOKING_CONFIRMED',
      performance.now(),
      true,
      { name: 'issue_ticket', params: { orderId: c.hold.orderId }, resultSummary: `PNR ${c.hold.pnr}`, durationMs: 500 }
    );
  }

  async paymentFailed(reason: UpiFailureReason, voice = true) {
    const c = this.context;
    if (!c.transaction || !c.hold) return;
    const txn = await paymentEngine.fail(c.transaction.transactionId, reason);
    c.transaction = { ...txn };
    analytics.track('payment_failed', { reason });
    const minsLeft = Math.max(0, Math.round((c.hold.holdExpiresAt - Date.now()) / 60000));
    c.step = 'option_selected';
    c.waitingForApproval = true;
    c.activeQuestion = 'approval';
    this.reply(
      `The payment didn't go through because ${FAILURE_COPY[reason]}. No money was taken. Your fare is still held for about ${minsLeft} minutes. Shall I send the payment request again?`,
      `PAYMENT_FAILED_${reason}`,
      performance.now(),
      voice
    );
  }

  /** Retry keeps the same order id (idempotency key) so a double tap can never double-charge. */
  async retryPayment(voice = true) {
    const c = this.context;
    if (!c.hold) return;
    analytics.track('payment_retry');
    const txn = await paymentEngine.requestPayment(c.hold.orderId, c.hold.amount, c.hold.passenger.upiId);
    c.transaction = txn;
    c.step = 'payment_pushed';
    c.waitingForApproval = false;
    c.activeQuestion = 'none';
    contextHarness.recordPayment(txn);
    this.reply(`Sent again for ${inr(c.hold.amount)}, same order, so you can't be charged twice. Please approve it in Paytm UPI.`, 'PAYMENT_RETRY', performance.now(), voice);
  }

  async simulateDebitedButPending(soldOut: boolean) {
    const c = this.context;
    if (!c.transaction || !c.hold) return;
    const txn = await paymentEngine.markDebitedButPending(c.transaction.transactionId);
    c.transaction = { ...txn };
    if (soldOut) {
      // Hold lapsed and the seat was sold meanwhile: the worst case
      c.hold = { ...c.hold, holdExpiresAt: Date.now() - 1000 };
      travelEngine.markSoldOut(c.hold.selectedOption.id);
    }
    this.system(soldOut ? 'Sandbox: bank debited, callback lost, hold expired and seat sold out' : 'Sandbox: bank debited, callback lost (ticket pending)');
    this.emit();
  }

  private async reconcile(t0: number, voice: boolean) {
    const c = this.context;
    c.step = 'payment_exception_recovery';
    this.emit();
    analytics.track('reconciliation_run');
    const inventory = c.hold ? travelEngine.isInventoryAvailable(c.hold.selectedOption.id) : false;
    const tTool = performance.now();
    const res = await paymentEngine.reconcile(c.hold, c.transaction, { inventoryAvailable: inventory });
    c.auditTrail = res.auditTrail;
    const tool = { name: 'reconcile_3_way', params: { orderId: c.hold?.orderId ?? null }, resultSummary: res.outcome, durationMs: Math.round(performance.now() - tTool) };

    if (res.outcome === 'TICKET_ISSUED' && c.hold) {
      c.hold = { ...c.hold, status: 'reconciled' };
      c.transaction = c.transaction ? { ...c.transaction, status: 'RECONCILED' } : null;
      c.step = 'confirmed';
      contextHarness.recordHold(c.hold);
      analytics.track('booking_confirmed', { amount: c.hold.amount, via: 'reconciliation' });
      return this.reply(`I checked the bank, our ledger and the ${c.hold.selectedOption.mode} operator. Your payment did reach us, and your ticket is now issued. PNR ${c.hold.pnr}. Sorry for the scare.`, 'RECONCILED_TICKET_ISSUED', t0, voice, tool);
    }
    if (res.outcome === 'AUTO_REFUND' && res.refund && c.hold) {
      c.refund = res.refund;
      c.hold = { ...c.hold, status: 'refunded' };
      c.transaction = c.transaction ? { ...c.transaction, status: 'REFUNDED' } : null;
      c.step = 'cancelled';
      contextHarness.recordRefund(res.refund.refundId, res.refund.refundAmount, 0, c.hold.orderId);
      analytics.track('refund_initiated', { amount: res.refund.refundAmount, reason: 'booking_failed_after_debit' });
      return this.reply(`Your bank did debit ${inr(res.refund.refundAmount)}, but the seat sold out before the ticket could be issued. I've started a full refund, ${res.refund.refundId}, with no fees. Want me to find you another option?`, 'RECONCILED_AUTO_REFUND', t0, voice, tool);
    }
    if (res.outcome === 'NO_DEBIT_FOUND') {
      c.step = c.hold ? 'option_selected' : 'idle';
      return this.reply("I checked with the bank and no money was debited for this booking, so there's nothing stuck. If your bank app shows a debit, it's usually a temporary hold that reverses on its own. Want me to retry the payment?", 'RECONCILED_NO_DEBIT', t0, voice, tool);
    }
    c.step = 'idle';
    return this.reply("I can't find a booking from you in the last 24 hours. If you paid on another device, share the order ID from your bank SMS and I'll trace it.", 'RECONCILED_NO_ORDER', t0, voice, tool);
  }

  // ---------------------------------------------------------------------------
  // Cancellation & policy
  // ---------------------------------------------------------------------------
  private quoteCancellation(t0: number, voice: boolean) {
    const c = this.context;
    if (!c.hold || !(c.hold.status === 'paid' || c.hold.status === 'reconciled')) {
      return this.reply("You don't have a confirmed booking with me in this session to cancel.", 'CANCEL_NO_BOOKING', t0, voice);
    }
    const q = quoteRefund(c.hold);
    c.refundQuote = q;
    c.step = 'cancellation_quoted';
    c.activeQuestion = 'cancel_confirm';
    contextHarness.recordRefund(`QUOTE-${q.orderId}`, q.refundAmount, q.cancellationFee, q.orderId);
    const fees = [`cancellation fee ${inr(q.cancellationFee)}`];
    if (q.nonRefundableConvenienceFee) fees.push(`convenience fee ${inr(q.nonRefundableConvenienceFee)}`);
    const text = q.refundAmount > 0
      ? `If you cancel now, you'll get back ${inr(q.refundAmount)} out of ${inr(q.paidAmount)}, after ${fees.join(' and ')}. Do you want to cancel?`
      : `This booking isn't refundable any more (${q.rule.toLowerCase()}). Cancelling now would refund nothing. Do you still want to cancel?`;
    return this.reply(text, 'CANCELLATION_QUOTED', t0, voice);
  }

  private async confirmCancellation(t0: number, voice: boolean) {
    const c = this.context;
    if (!c.hold || !c.refundQuote) return;
    const refund = await paymentEngine.refund(c.hold, c.transaction, c.refundQuote);
    c.refund = refund;
    c.hold = { ...c.hold, status: 'cancelled' };
    c.step = 'cancelled';
    c.activeQuestion = 'none';
    contextHarness.recordRefund(refund.refundId, refund.refundAmount, refund.cancellationFee, c.hold.orderId);
    analytics.track('cancellation_completed', { refund: refund.refundAmount });
    if (refund.refundAmount > 0) analytics.track('refund_initiated', { amount: refund.refundAmount, reason: 'customer_cancellation' });
    return this.reply(`Cancelled. Refund ${refund.refundId} of ${inr(refund.refundAmount)} is on its way ${refund.eta}.`, 'CANCELLATION_DONE', t0, voice, {
      name: 'cancel_and_refund',
      params: { orderId: c.hold.orderId },
      resultSummary: `${refund.refundId}: ${inr(refund.refundAmount)}`,
      durationMs: 400,
    });
  }

  private policyAnswer(intent: 'ask_baggage' | 'ask_cancellation_policy', t0: number, voice: boolean) {
    const c = this.context;
    const opt = c.selectedOption ?? c.hold?.selectedOption ?? null;
    if (!opt) {
      return this.reply('Pick an option first and I will read out its exact baggage and cancellation rules.', 'POLICY_NEEDS_OPTION', t0, voice);
    }
    const text = intent === 'ask_baggage'
      ? `${opt.provider} ${opt.serviceNumber}: cabin ${opt.baggage.cabin.toLowerCase()}, check-in ${opt.baggage.checkIn.toLowerCase()}.`
      : `${opt.provider} ${opt.serviceNumber}: ${opt.cancellation.refundSummary}. Fee is ${inr(opt.cancellation.feeBefore24h)} per traveller more than 24 hours before departure, ${inr(opt.cancellation.feeWithin24h)} within 24 hours. The ${inr(opt.convenienceFee)} convenience fee isn't refundable.`;
    return this.reply(text, intent === 'ask_baggage' ? 'BAGGAGE_POLICY' : 'CANCELLATION_POLICY', t0, voice, {
      name: 'get_fare_rules',
      params: { optionId: opt.id },
      resultSummary: 'Rules read from fare data',
      durationMs: 0,
    });
  }

  private bookingStatus(t0: number, voice: boolean) {
    const h = this.context.hold;
    if (!h) return this.reply('You have no bookings in this session yet. Where would you like to go?', 'STATUS_NONE', t0, voice);
    const label: Record<BookingHold['status'], string> = {
      held: 'on hold, waiting for payment',
      paid: 'confirmed',
      reconciled: 'confirmed',
      expired: 'expired',
      released: 'released',
      cancelled: 'cancelled',
      refunded: 'refunded',
    };
    return this.reply(`Your ${h.selectedOption.provider} booking ${h.orderId} is ${label[h.status]}${h.status === 'paid' || h.status === 'reconciled' ? `, PNR ${h.pnr}` : ''}.`, 'BOOKING_STATUS', t0, voice);
  }

  // ---------------------------------------------------------------------------
  // Output: grounding validator + TTS
  // ---------------------------------------------------------------------------
  private reply(text: string, intent: string, t0: number, voice: boolean, toolCall?: Message['toolCall']) {
    const check = contextHarness.validateReply(text);
    let spoken = text;
    if (!check.ok) {
      analytics.track('ungrounded_claim_blocked', { intent, claims: check.ungrounded.join(' ') });
      this.system(`Grounding guard blocked an unverified claim: ${check.ungrounded.join(', ')}`);
      spoken = "Let me double-check that before I tell you a number. Could you say that again, or pick an option on screen?";
    }
    this.append({
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      role: 'agent',
      text: spoken,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: intent,
      latencyMs: Math.round(performance.now() - t0),
      toolCall,
    });
    if (voice) speechService.speak(spoken);
  }

  private system(text: string) {
    this.append({ id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, role: 'system', text, timestamp: new Date().toLocaleTimeString() });
  }

  private append(m: Message) {
    this.context.messages = [...this.context.messages, m];
    this.emit();
  }
}
