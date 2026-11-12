// End-to-end journeys through the real orchestrator (LLM unreachable in tests, so the rules fallback is used).
import { describe, it, expect } from 'vitest';
import { VoiceAgentOrchestrator, type AgentContext } from '../services/voiceAgentOrchestrator';

function agent() {
  let ctx!: AgentContext;
  const o = new VoiceAgentOrchestrator((c) => (ctx = c));
  ctx = o.getContext();
  const say = async (t: string) => {
    await o.handleUserUtterance(t, false);
    return ctx;
  };
  const lastAgent = () => [...ctx.messages].reverse().find((m) => m.role === 'agent')!.text;
  return { o, say, get ctx() { return ctx; }, lastAgent };
}

describe('Booking journey', () => {
  it('goes from one sentence to options with zero follow-up questions', async () => {
    const a = agent();
    const c = await a.say('Mumbai se Nagpur agle Friday, 2 log, train');
    expect(c.options.length).toBeGreaterThan(0);
    expect(c.options.every((o) => o.mode === 'train')).toBe(true);
    expect(a.lastAgent()).toMatch(/found \d+ options from Mumbai to Nagpur/);
  });

  it('asks only for missing details', async () => {
    const a = agent();
    await a.say('I want to go to Jaipur tomorrow');
    expect(a.ctx.activeQuestion).toBe('origin');
    await a.say('Delhi');
    expect(a.ctx.activeQuestion).toBe('passengers');
    await a.say('3');
    expect(a.ctx.options.length).toBeGreaterThan(0);
    expect(a.ctx.passengersCount).toBe(3);
  });

  it('never books without explicit approval, then books, pays and cancels with correct refund', async () => {
    const a = agent();
    await a.say('Delhi to Jaipur tomorrow 1 person flight');
    await a.say('sabse sasta');
    expect(a.ctx.waitingForApproval).toBe(true);
    expect(a.ctx.hold).toBeNull();

    await a.say('yes');
    expect(a.ctx.activeQuestion).toBe('name');
    await a.say('Riya Sharma');
    expect(a.ctx.hold?.status).toBe('held');
    expect(a.ctx.transaction?.status).toBe('PUSHED');

    await a.o.handleSimulatedPaymentApproval();
    expect(a.ctx.step).toBe('confirmed');

    await a.say('I want to cancel my booking');
    expect(a.ctx.refundQuote).not.toBeNull();
    const q = a.ctx.refundQuote!;
    expect(q.refundAmount).toBe(q.paidAmount - q.cancellationFee - q.nonRefundableConvenienceFee);
    await a.say('yes');
    expect(a.ctx.hold?.status).toBe('cancelled');
    expect(a.ctx.refund?.refundAmount).toBe(q.refundAmount);
  });
});

describe('Payment failure patterns', () => {
  async function toPayment() {
    const a = agent();
    await a.say('Pune to Goa tomorrow 2 people bus');
    await a.say('book option 1');
    await a.say('haan');
    await a.say('Aman Verma');
    return a;
  }

  it('retries a failed UPI payment on the same order id', async () => {
    const a = await toPayment();
    const order = a.ctx.hold!.orderId;
    await a.o.paymentFailed('BANK_TIMEOUT', false);
    expect(a.lastAgent()).toMatch(/No money was taken/);
    await a.say('yes');
    expect(a.ctx.transaction?.status).toBe('PUSHED');
    expect(a.ctx.transaction?.orderId).toBe(order);
  });

  it('debited but pending: reconciliation issues the ticket', async () => {
    const a = await toPayment();
    await a.o.simulateDebitedButPending(false);
    await a.say('Paise kat gaye but ticket pending hai');
    expect(a.ctx.hold?.status).toBe('reconciled');
    expect(a.ctx.auditTrail.length).toBeGreaterThan(2);
  });

  it('debited and seat sold out: reconciliation auto-refunds in full', async () => {
    const a = await toPayment();
    const paid = a.ctx.hold!.amount;
    await a.o.simulateDebitedButPending(true);
    await a.say('money deducted but ticket not confirmed');
    expect(a.ctx.hold?.status).toBe('refunded');
    expect(a.ctx.refund?.refundAmount).toBe(paid);
  });
});

describe('Guardrails', () => {
  it('blocks a spoken UPI PIN and never stores it', async () => {
    const a = agent();
    await a.say('my upi pin is 4821');
    expect(a.ctx.messages.some((m) => m.text.includes('4821'))).toBe(false);
    expect(a.lastAgent()).toMatch(/never share your UPI PIN/);
  });
});
