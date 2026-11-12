import { describe, it, expect, beforeEach } from 'vitest';
import { ContextEngineeringHarness } from '../services/contextHarness';
import { quoteRefund } from '../services/paymentEngine';
import { travelEngine } from '../services/travelEngine';
import type { BookingHold } from '../types';

describe('Context harness: inbound guards', () => {
  const h = new ContextEngineeringHarness();

  it('blocks a UPI PIN or OTP spoken with a keyword', () => {
    expect(h.checkCredentials('my upi pin is 4821', 'discover').safe).toBe(false);
    expect(h.checkCredentials('OTP 739201 aaya hai', 'compare').safe).toBe(false);
  });

  it('blocks a bare 4/6 digit number only at the payment stage', () => {
    expect(h.checkCredentials('4821', 'pay').safe).toBe(false);
    expect(h.checkCredentials('4', 'discover').safe).toBe(true); // "4" = date or passengers earlier in the flow
  });

  it('blocks card numbers anywhere', () => {
    expect(h.checkCredentials('card 4111 1111 1111 1111', 'discover').safe).toBe(false);
  });

  it('does not block normal trip talk with numbers', () => {
    expect(h.checkCredentials('2 people on 14th', 'discover').safe).toBe(true);
  });

  it('redacts long digit runs before text leaves the device', () => {
    const r = h.redact('call me on 98450 12345 please');
    expect(r.text).toContain('[REDACTED_NUMBER]');
    expect(r.count).toBe(1);
  });
});

describe('Context harness: slot ledger and context budget', () => {
  let h: ContextEngineeringHarness;
  beforeEach(() => {
    h = new ContextEngineeringHarness();
  });

  it('tracks provenance and reports missing required slots', () => {
    h.nextTurn();
    h.applySlots({ destination: 'Nagpur', passengers: 2 }, 'llm');
    expect(h.missingRequired()).toEqual(['origin', 'dateISO']);
    expect(h.getLedger().destination).toMatchObject({ value: 'Nagpur', source: 'llm', turn: 1 });
  });

  it('keeps the NLU prompt within its token budget with a sliding dialogue window, never dropping policy or state', () => {
    h.applySlots({ destination: 'Goa' }, 'rules');
    const longTurns = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      role: (i % 2 ? 'agent' : 'user') as 'agent' | 'user',
      text: 'blah '.repeat(60),
      timestamp: '',
    }));
    const prompt = h.buildNluContext('discover', 'origin', longTurns, '2026-11-12');
    const trace = h.getLastTrace()!;
    expect(trace.approxTokens).toBeLessThanOrEqual(trace.budgetTokens);
    expect(prompt).toContain('### POLICY');
    expect(prompt).toContain('destination=Goa');
    // Only the last 6 turns are ever considered, each capped, so 40 long turns cannot blow the budget
    expect(trace.sections.find((x) => x.name.startsWith('Dialogue'))!.name).toBe('Dialogue (last 6)');
  });
});

describe('Context harness: grounding validator', () => {
  it('accepts amounts and codes that came from tools and rejects invented ones', async () => {
    const h = new ContextEngineeringHarness();
    const { options } = await travelEngine.searchTransportOptions('Mumbai', 'Nagpur', 'x', null, 'all', 1);
    h.recordOptions(options);
    const o = options[0];
    expect(h.validateReply(`${o.provider} ${o.serviceNumber} costs ₹${o.price.toLocaleString('en-IN')}`).ok).toBe(true);
    const bad = h.validateReply('Your PNR is 6E-W8KZ7Q and it costs ₹1,234');
    expect(bad.ok).toBe(false);
    expect(bad.ungrounded).toEqual(expect.arrayContaining(['₹1,234', '6E-W8KZ7Q']));
  });
});

describe('Refund policy', () => {
  const makeHold = async (hoursAhead: number, pax = 2): Promise<BookingHold> => {
    const { options } = await travelEngine.searchTransportOptions('Delhi', 'Jaipur', 'x', null, 'flight', pax);
    const dep = new Date(Date.now() + hoursAhead * 36e5);
    const opt = { ...options[0], departureTime: dep.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    const iso = `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, '0')}-${String(dep.getDate()).padStart(2, '0')}`;
    return { orderId: 'ORD-1', selectedOption: opt, passenger: {} as never, holdExpiresAt: 0, fareGuaranteed: true, amount: opt.price, passengers: pax, travelDateISO: iso, status: 'paid' };
  };

  it('charges the >24h fee per traveller and never refunds the convenience fee', async () => {
    const hold = await makeHold(72, 2);
    const q = quoteRefund(hold);
    const o = hold.selectedOption;
    expect(q.cancellationFee).toBe(o.cancellation.feeBefore24h * 2);
    expect(q.refundAmount).toBe(hold.amount - q.cancellationFee - o.convenienceFee);
  });

  it('uses the higher fee inside 24h', async () => {
    const hold = await makeHold(5, 1);
    expect(quoteRefund(hold).cancellationFee).toBe(hold.selectedOption.cancellation.feeWithin24h);
  });

  it('refunds nothing after departure', async () => {
    const hold = await makeHold(-3, 1);
    expect(quoteRefund(hold).refundAmount).toBe(0);
  });
});
