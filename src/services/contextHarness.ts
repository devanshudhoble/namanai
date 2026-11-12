// =============================================================================
// Context Engineering Harness
// =============================================================================
// The LLM is only as good as the context it is given. This harness owns that context.
// It decides what the model sees on every turn, and checks what comes back before a customer hears it.
//
//  INBOUND  (user -> model)
//   1. Credential guard   : blocks UPI PIN / OTP / CVV before they reach logs or the LLM
//   2. PII redaction      : masks phone / card / account-like digit runs in text sent to the LLM
//   3. Layered context    : POLICY > STATE > GROUNDED FACTS > DIALOGUE WINDOW, under a token budget
//
//  STATE
//   4. Slot ledger        : one source of truth for trip details, with provenance (llm / rules / ui) and turn
//   5. Fact store         : only tool outputs (search, hold, payment, refund) count as facts
//
//  OUTBOUND (model/agent -> user)
//   6. Grounding validator: every ₹ amount / PNR / order id in a spoken reply must exist in the fact store,
//                           otherwise the reply is replaced with a safe template.
//   7. Context trace      : what was sent, how big, what was dropped. Shown in the Insights drawer.
// =============================================================================

import type { Message, TravelOption, BookingHold, PaymentTransaction } from '../types';
import type { ExtractedSlots } from './nlu';
import { INTENTS } from './nlu';

export type SlotKey = keyof ExtractedSlots;
export type SlotSource = 'llm' | 'rules' | 'ui' | 'default';

export interface SlotEntry {
  value: string | number;
  source: SlotSource;
  turn: number;
}

export type JourneyStage = 'discover' | 'compare' | 'approve' | 'pay' | 'post_booking' | 'support';

export const REQUIRED_SLOTS: SlotKey[] = ['destination', 'origin', 'dateISO', 'passengers'];

export interface GroundedFact {
  kind: 'option' | 'hold' | 'payment' | 'refund';
  id: string;
  /** Every number / code a reply may legitimately mention. */
  amounts: number[];
  codes: string[];
  summary: string;
  tool: string;
  at: number;
}

export interface ContextTrace {
  turn: number;
  stage: JourneyStage;
  approxTokens: number;
  budgetTokens: number;
  sections: { name: string; chars: number; included: boolean }[];
  droppedDialogueTurns: number;
  redactions: number;
}

export interface GroundingCheck {
  ok: boolean;
  ungrounded: string[];
}

const TOKEN_BUDGET = 1200; // context budget for the NLU call; keeps latency + cost predictable
const DIALOGUE_WINDOW = 6;
const approxTokens = (s: string) => Math.ceil(s.length / 4);

const POLICY = `You are the language-understanding layer of a voice travel booking agent for Indian users
(English, Hindi, Hinglish). Convert the user's latest utterance into JSON. Rules:
- Extract EVERY trip detail present in the utterance (one sentence may contain all of them).
- Only extract what the user actually said. Never guess origin, date or passenger count.
- Dates: resolve relative/Hinglish dates ("kal", "parso", "agle shukrawar", "4 tarikh") against TODAY. Output YYYY-MM-DD.
- Cities: output the canonical English city name (e.g. "Bombay" -> "Mumbai", "Bangalore" -> "Bengaluru").
- A bare answer (e.g. "2", "Pune") answers the ACTIVE QUESTION in STATE.
- Never output prices, PNRs, availability or seat numbers. You do not know them.
- If the user shares a PIN/OTP/CVV, set intent "other". Never repeat it.
Allowed intents: ${INTENTS.join(', ')}.`;

export class ContextEngineeringHarness {
  private slots: Partial<Record<SlotKey, SlotEntry>> = {};
  private facts: GroundedFact[] = [];
  private turn = 0;
  private traces: ContextTrace[] = [];

  reset() {
    this.slots = {};
    this.facts = [];
    this.turn = 0;
    this.traces = [];
  }

  nextTurn() {
    this.turn += 1;
    return this.turn;
  }

  // ---------------------------------------------------------------------------
  // 1-2. Inbound guards
  // ---------------------------------------------------------------------------

  /** Blocks payment secrets. At the payment stage even a bare 4/6 digit number is treated as a likely UPI PIN/OTP. */
  checkCredentials(text: string, stage: JourneyStage): { safe: boolean; reason?: string } {
    const lower = text.toLowerCase();
    const secretWord = /\b(otp|cvv|upi pin|pin|password|passcode|mpin)\b/.test(lower);
    const hasDigits = /\b\d{3,6}\b/.test(lower);
    const cardLike = /\b(?:\d[ -]?){13,19}\b/.test(lower);
    if (cardLike) return { safe: false, reason: 'card_number' };
    if (secretWord && hasDigits) return { safe: false, reason: 'pin_or_otp' };
    if (stage === 'pay' && /^\s*\d{4}(\d{2})?\s*$/.test(lower)) return { safe: false, reason: 'bare_pin_at_payment' };
    return { safe: true };
  }

  /** Masks long digit runs (phone, account, card) before text leaves the device for the LLM. */
  redact(text: string): { text: string; count: number } {
    let count = 0;
    const out = text.replace(/\b\d[\d -]{8,}\d\b/g, () => {
      count += 1;
      return '[REDACTED_NUMBER]';
    });
    return { text: out, count };
  }

  // ---------------------------------------------------------------------------
  // 4. Slot ledger
  // ---------------------------------------------------------------------------

  applySlots(slots: ExtractedSlots, source: SlotSource): SlotKey[] {
    const changed: SlotKey[] = [];
    for (const [k, v] of Object.entries(slots) as [SlotKey, string | number | undefined][]) {
      if (v === undefined || v === null || v === '') continue;
      const prev = this.slots[k];
      if (prev && prev.value === v) continue;
      this.slots[k] = { value: v, source, turn: this.turn };
      changed.push(k);
    }
    return changed;
  }

  setSlot(key: SlotKey, value: string | number, source: SlotSource) {
    this.slots[key] = { value, source, turn: this.turn };
  }

  clearSlot(key: SlotKey) {
    delete this.slots[key];
  }

  getSlot<T = string | number>(key: SlotKey): T | undefined {
    return this.slots[key]?.value as T | undefined;
  }

  getLedger() {
    return { ...this.slots };
  }

  missingRequired(): SlotKey[] {
    return REQUIRED_SLOTS.filter((k) => this.slots[k] === undefined);
  }

  // ---------------------------------------------------------------------------
  // 5. Fact store: only tool outputs are facts
  // ---------------------------------------------------------------------------

  recordOptions(options: TravelOption[]) {
    this.facts = this.facts.filter((f) => f.kind !== 'option');
    for (const o of options) {
      this.facts.push({
        kind: 'option',
        id: o.id,
        amounts: [o.price, o.baseFare, o.taxesAndFees, o.convenienceFee, o.cancellation.feeBefore24h, o.cancellation.feeWithin24h],
        codes: [o.serviceNumber],
        summary: `${o.mode}|${o.provider}|${o.serviceNumber}|dep ${o.departureTime}|${o.duration}|₹${o.price}`,
        tool: 'search_transport_options',
        at: Date.now(),
      });
    }
  }

  recordHold(hold: BookingHold) {
    this.facts.push({
      kind: 'hold',
      id: hold.orderId,
      amounts: [hold.amount],
      codes: [hold.orderId, hold.pnr ?? ''].filter(Boolean),
      summary: `hold ${hold.orderId} ₹${hold.amount} status=${hold.status}`,
      tool: 'lock_fare_and_hold',
      at: Date.now(),
    });
  }

  recordPayment(txn: PaymentTransaction) {
    this.facts.push({
      kind: 'payment',
      id: txn.transactionId,
      amounts: [txn.amount],
      codes: [txn.transactionId, txn.orderId],
      summary: `txn ${txn.transactionId} ₹${txn.amount} status=${txn.status}`,
      tool: 'upi_payment',
      at: Date.now(),
    });
  }

  recordRefund(refundId: string, amount: number, fee: number, orderId: string) {
    this.facts.push({
      kind: 'refund',
      id: refundId,
      amounts: [amount, fee],
      codes: [refundId, orderId],
      summary: `refund ${refundId} ₹${amount} (fee ₹${fee})`,
      tool: 'refund_engine',
      at: Date.now(),
    });
  }

  getFacts() {
    return [...this.facts];
  }

  // ---------------------------------------------------------------------------
  // 3 + 7. Layered context assembly under a token budget, with a trace
  // ---------------------------------------------------------------------------

  buildNluContext(stage: JourneyStage, activeQuestion: string, dialogue: Message[], todayISO: string): string {
    const slotLines = Object.entries(this.slots)
      .map(([k, e]) => `${k}=${e!.value} (from ${e!.source}, turn ${e!.turn})`)
      .join('\n');
    const state = `TODAY=${todayISO}\nJOURNEY_STAGE=${stage}\nACTIVE_QUESTION=${activeQuestion}\nMISSING=${this.missingRequired().join(',') || 'none'}\nSLOTS:\n${slotLines || '(none yet)'}`;

    // Facts are only useful to the NLU once the user is comparing options ("the second one", "the cheaper train")
    const optionFacts = this.facts.filter((f) => f.kind === 'option');
    const facts =
      stage === 'discover' || !optionFacts.length
        ? ''
        : optionFacts.map((f, i) => `option ${i + 1}: ${f.summary}`).join('\n');

    let redactions = 0;
    const turns = dialogue
      .filter((m) => m.role !== 'system')
      .slice(-DIALOGUE_WINDOW)
      .map((m) => {
        const r = this.redact(m.text.slice(0, 220));
        redactions += r.count;
        return `${m.role === 'user' ? 'USER' : 'AGENT'}: ${r.text}`;
      });

    const fixed = [`### POLICY\n${POLICY}`, `### STATE\n${state}`, facts ? `### OPTIONS ON SCREEN (ground truth)\n${facts}` : ''];
    let dropped = 0;
    const assemble = () => [...fixed, turns.length ? `### RECENT DIALOGUE\n${turns.join('\n')}` : ''].filter(Boolean).join('\n\n');
    let prompt = assemble();
    // Trim oldest dialogue first. Policy, state and facts are never dropped.
    while (approxTokens(prompt) > TOKEN_BUDGET && turns.length > 1) {
      turns.shift();
      dropped += 1;
      prompt = assemble();
    }

    this.traces.push({
      turn: this.turn,
      stage,
      approxTokens: approxTokens(prompt),
      budgetTokens: TOKEN_BUDGET,
      sections: [
        { name: 'Policy', chars: fixed[0].length, included: true },
        { name: 'State (slot ledger)', chars: fixed[1].length, included: true },
        { name: 'Grounded options', chars: facts.length, included: Boolean(facts) },
        { name: `Dialogue (last ${turns.length})`, chars: turns.join('\n').length, included: turns.length > 0 },
      ],
      droppedDialogueTurns: dropped,
      redactions,
    });
    if (this.traces.length > 50) this.traces.shift();
    return prompt;
  }

  getLastTrace(): ContextTrace | undefined {
    return this.traces[this.traces.length - 1];
  }

  // ---------------------------------------------------------------------------
  // 6. Outbound grounding validator
  // ---------------------------------------------------------------------------

  /**
   * Every rupee amount and booking code in `reply` must exist in the fact store
   * (or be derivable from the slots, e.g. passenger count). Anything else is a hallucination.
   */
  validateReply(reply: string): GroundingCheck {
    const allowedAmounts = new Set<number>();
    const allowedCodes = new Set<string>();
    for (const f of this.facts) {
      f.amounts.forEach((a) => allowedAmounts.add(Math.round(a)));
      f.codes.forEach((c) => allowedCodes.add(c.toUpperCase()));
    }
    const ungrounded: string[] = [];

    const amountRe = /(?:₹|rs\.?\s?|inr\s?|rupees\s)(\d[\d,]*(?:\.\d+)?)/gi;
    let m: RegExpExecArray | null;
    while ((m = amountRe.exec(reply))) {
      const n = Math.round(parseFloat(m[1].replace(/,/g, '')));
      if (!allowedAmounts.has(n)) ungrounded.push(m[0]);
    }

    // Booking-code-like tokens: PNRs, order ids, txn ids, refund ids (must contain a digit and a dash)
    const codeRe = /\b(?=[A-Z0-9-]*\d)[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+\b/g;
    while ((m = codeRe.exec(reply))) {
      if (!allowedCodes.has(m[0].toUpperCase())) ungrounded.push(m[0]);
    }
    return { ok: ungrounded.length === 0, ungrounded };
  }
}

export const contextHarness = new ContextEngineeringHarness();
