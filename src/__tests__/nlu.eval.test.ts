// Golden-set evaluation of the offline NLU (the fallback that must work when the LLM is down).
// Each case is a realistic utterance (English / Hindi / Hinglish) with the expected intent + slots.
// The run prints slot-level accuracy and fails if it drops below the bar, so regressions are caught in CI.
// The same set is meant to be run against the Gemini path (see docs/CASE_STUDY.md, "Evaluation").

import { describe, it, expect } from 'vitest';
import { rulesUnderstand, parseIndianDate, type DialogueState, type ExtractedSlots, type Intent } from '../services/nlu';

// Thursday 12 Nov 2026
const TODAY = new Date(2026, 10, 12);

const base: DialogueState = {
  activeQuestion: 'destination',
  hasOptions: false,
  awaitingApproval: false,
  awaitingCancelConfirm: false,
  hasConfirmedBooking: false,
  hasPendingPayment: false,
  today: TODAY,
};

interface Case {
  say: string;
  state?: Partial<DialogueState>;
  intent: Intent;
  slots?: ExtractedSlots;
}

const GOLDEN: Case[] = [
  // One-shot, everything in one sentence
  { say: 'Mumbai to Nagpur next Friday, 2 people, train', intent: 'trip_details', slots: { origin: 'Mumbai', destination: 'Nagpur', dateISO: '2026-11-20', passengers: 2, mode: 'train' } },
  { say: 'Mumbai se Nagpur agle Friday, 2 log, train mein', intent: 'trip_details', slots: { origin: 'Mumbai', destination: 'Nagpur', dateISO: '2026-11-20', passengers: 2, mode: 'train' } },
  { say: 'Delhi to Jaipur tomorrow, 3 people', intent: 'trip_details', slots: { origin: 'Delhi', destination: 'Jaipur', dateISO: '2026-11-13', passengers: 3 } },
  { say: 'Bangalore se Goa parso flight, just me', intent: 'trip_details', slots: { origin: 'Bengaluru', destination: 'Goa', dateISO: '2026-11-14', passengers: 1, mode: 'flight' } },
  { say: 'I need to go to Pune from Hyderabad on 4th December', intent: 'trip_details', slots: { origin: 'Hyderabad', destination: 'Pune', dateISO: '2026-12-04' } },
  { say: 'Kal Lucknow jana hai Delhi se, hum dono', intent: 'trip_details', slots: { origin: 'Delhi', destination: 'Lucknow', dateISO: '2026-11-13', passengers: 2 } },
  { say: 'Chennai to Madurai 3AC on 20 nov for 4 travellers', intent: 'trip_details', slots: { origin: 'Chennai', destination: 'Madurai', dateISO: '2026-11-20', passengers: 4, mode: 'train', travelClass: '3AC' } },
  { say: 'Bombay to Calcutta this weekend by bus', intent: 'trip_details', slots: { origin: 'Mumbai', destination: 'Kolkata', dateISO: '2026-11-14', mode: 'bus' } },
  // Partial intents
  { say: 'I want to go to Jaipur tomorrow', intent: 'trip_details', slots: { destination: 'Jaipur', dateISO: '2026-11-13' } },
  { say: 'Nagpur', intent: 'trip_details', slots: { destination: 'Nagpur' } },
  { say: 'Wardha se', state: { activeQuestion: 'origin' }, intent: 'trip_details', slots: { origin: 'Wardha' } },
  { say: 'Pachmarhi', state: { activeQuestion: 'destination' }, intent: 'trip_details', slots: { destination: 'Pachmarhi' } },
  // Bare answers depend on the question that was asked
  { say: '4', state: { activeQuestion: 'date' }, intent: 'trip_details', slots: { dateISO: '2026-12-04' } },
  { say: '20', state: { activeQuestion: 'date' }, intent: 'trip_details', slots: { dateISO: '2026-11-20' } },
  { say: '2', state: { activeQuestion: 'passengers' }, intent: 'trip_details', slots: { passengers: 2 } },
  { say: 'teen log', state: { activeQuestion: 'passengers' }, intent: 'trip_details', slots: { passengers: 3 } },
  { say: 'agle shukrawar', state: { activeQuestion: 'date' }, intent: 'trip_details', slots: { dateISO: '2026-11-20' } },
  // Comparison stage
  { say: 'Sabse sasta option kaunsa hai?', state: { hasOptions: true, activeQuestion: 'options' }, intent: 'ask_cheaper' },
  { say: 'which is the fastest', state: { hasOptions: true, activeQuestion: 'options' }, intent: 'ask_fastest' },
  { say: 'book option 2', state: { hasOptions: true, activeQuestion: 'options' }, intent: 'select_option' },
  { say: 'what if I go one day later', state: { hasOptions: true, activeQuestion: 'options' }, intent: 'shift_date' },
  // Approval
  { say: 'haan kar do', state: { awaitingApproval: true, activeQuestion: 'approval' }, intent: 'approve' },
  { say: 'nahi, ruko', state: { awaitingApproval: true, activeQuestion: 'approval' }, intent: 'decline' },
  { say: 'My name is Riya Sharma', state: { activeQuestion: 'name' }, intent: 'give_name', slots: { passengerName: 'Riya Sharma' } },
  // Support & payments
  { say: 'Paise kat gaye but ticket pending hai', intent: 'payment_issue' },
  { say: 'money was deducted from my account but no ticket', intent: 'payment_issue' },
  { say: 'payment failed', state: { hasPendingPayment: true }, intent: 'payment_failed' },
  { say: 'I want to cancel my booking', state: { hasConfirmedBooking: true }, intent: 'cancel_booking' },
  { say: 'what is the cancellation policy', intent: 'ask_cancellation_policy' },
  { say: 'is check-in baggage included?', intent: 'ask_baggage' },
];

describe('NLU golden set (offline rules engine)', () => {
  let intentHits = 0;
  let slotHits = 0;
  let slotTotal = 0;
  const failures: string[] = [];

  for (const c of GOLDEN) {
    const got = rulesUnderstand(c.say, { ...base, ...c.state });
    if (got.intent === c.intent) intentHits += 1;
    else failures.push(`intent "${c.say}": expected ${c.intent}, got ${got.intent}`);
    for (const [k, v] of Object.entries(c.slots ?? {})) {
      slotTotal += 1;
      const actual = (got.slots as Record<string, unknown>)[k];
      if (actual === v) slotHits += 1;
      else failures.push(`slot ${k} "${c.say}": expected ${v}, got ${actual}`);
    }
  }

  it('meets the accuracy bar', () => {
    const intentAcc = intentHits / GOLDEN.length;
    const slotAcc = slotHits / slotTotal;
    console.log(`\nNLU golden set: ${GOLDEN.length} utterances, intent accuracy ${(intentAcc * 100).toFixed(1)}%, slot accuracy ${(slotAcc * 100).toFixed(1)}% (${slotHits}/${slotTotal})`);
    if (failures.length) console.log('Misses:\n  ' + failures.join('\n  '));
    expect(intentAcc).toBeGreaterThanOrEqual(0.9);
    expect(slotAcc).toBeGreaterThanOrEqual(0.9);
  });
});

describe('Date parser edge cases', () => {
  it('rolls a past day-of-month into next month', () => {
    expect(parseIndianDate('5th', TODAY)).toBe('2026-12-05');
  });
  it('rolls a past month into next year', () => {
    expect(parseIndianDate('4 march', TODAY)).toBe('2027-03-04');
  });
  it('does not treat a bare number as a date unless asked', () => {
    expect(parseIndianDate('2', TODAY)).toBeNull();
  });
});
