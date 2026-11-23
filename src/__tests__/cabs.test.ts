// Paytm Travel Cabs: the case study's PRD acceptance criteria as eval cases, run through the real orchestrator.
import { describe, it, expect } from 'vitest';
import { VoiceAgentOrchestrator, type AgentContext } from '../services/voiceAgentOrchestrator';
import { parseCabRequest, rankOptions, rentals, trips, share, airport, WEIGHTS } from '../services/cabsEngine';

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

async function bookTopPick(a: ReturnType<typeof agent>) {
  a.o.handleSelectOptionExplicitly(a.ctx.options[0]);
  expect(a.ctx.waitingForApproval).toBe(true);
  expect(a.ctx.hold).toBeNull(); // never books before the yes
  await a.say('haan, book karo');
  await a.say('Ananya Rao');
  await a.o.handleSimulatedPaymentApproval();
  expect(a.ctx.hold?.status).toBe('paid');
}

describe('Voice understanding for cabs', () => {
  it('classifies the four products from Hinglish', () => {
    expect(parseCabRequest('Kal subah 6 baje airport ke liye cab chahiye')?.product).toBe('airport');
    expect(parseCabRequest('6E 2134 se aa rahi hoon, airport se ghar cab')).toMatchObject({ product: 'airport', direction: 'pickup', flightNumber: '6E 2134' });
    expect(parseCabRequest('Kal 8 ghante ke liye gaadi chahiye')).toMatchObject({ product: 'rental', hours: 8 });
    expect(parseCabRequest('Bangalore se Coorg 3 din, Innova chahiye, budget 10000')).toMatchObject({ product: 'trip', days: 3, budget: 10000, to: 'Coorg' });
    expect(parseCabRequest('HSR se Whitefield shared seat office')?.product).toBe('share');
    expect(parseCabRequest('Mumbai se Nagpur train')).toBeNull();
  });
});

describe('Airport (flight-linked, fixed fare)', () => {
  it('drop: speaks flight status, leave-by time and a fixed fare, then books only after yes', async () => {
    const a = agent();
    const c = await a.say('Kal subah 6 baje airport ke liye cab chahiye');
    expect(c.options.length).toBeGreaterThan(0);
    expect(c.options.every((o) => o.cab && o.quoteId)).toBe(true);
    expect(a.lastAgent()).toMatch(/6E 512/);
    expect(a.lastAgent()).toMatch(/Fixed fare ₹[\d,]+/);
    a.o.handleSelectOptionExplicitly(c.options[0]);
    expect(a.lastAgent()).toMatch(/all-inclusive/);
    expect(a.lastAgent()).toMatch(/nothing extra to the driver/);
  });

  it('GIVEN cab added to a flight WHEN flight delayed 15+ min THEN pickup moves, user told, no charge', async () => {
    const a = agent();
    await a.say('6E 2134 se aa rahi hoon, airport se ghar cab chahiye');
    const firstCab = a.ctx.options.find((o) => o.mode === 'cab')!;
    a.o.handleSelectOptionExplicitly(firstCab);
    await a.say('haan, book karo');
    await a.say('Ananya Rao');
    await a.o.handleSimulatedPaymentApproval();
    const paid = a.ctx.hold!.amount;
    const before = a.ctx.hold!.selectedOption.departureTime;
    await a.say('Meri flight 45 min late hai');
    expect(a.lastAgent()).toMatch(/moved your pickup/);
    expect(a.lastAgent()).toMatch(/No charge/);
    expect(a.ctx.hold!.selectedOption.departureTime).not.toBe(before);
    expect(a.ctx.hold!.amount).toBe(paid);
  });

  it('GIVEN driver not there WHEN rider reports it THEN backup in 5 min at the same fare', async () => {
    const a = agent();
    await a.say('Kal subah 6 baje airport ke liye cab chahiye');
    await bookTopPick(a);
    const original = a.ctx.hold!.selectedOption.operator;
    await a.say('Driver nahi aaya abhi tak');
    expect(a.lastAgent()).toMatch(/backup cab/);
    expect(a.lastAgent()).toMatch(/5 minutes/);
    expect(a.ctx.hold!.selectedOption.operator).not.toBe(original);
  });
});

describe('Rentals (compare local companies, AI all-in)', () => {
  it('adds extra km, tolls and parking to the all-in price for a 95 km plan', () => {
    const r = rentals({ product: 'rental', hours: 8, plannedKm: 95 }, 5);
    expect(r.options.length).toBeGreaterThan(2);
    for (const o of r.options) {
      expect(o.price).toBe(o.cab!.lines.reduce((s, l) => s + l.amount, 0)); // fixed fare: charge = quote
      expect(o.cab!.lines.some((l) => l.label === 'Extra 15 km')).toBe(true);
    }
    const tags = r.options.map((o) => o.recommendationTag).join(' ');
    expect(tags).toMatch(/AI top pick/);
    expect(tags).toMatch(/Best value/);
    expect(tags).toMatch(/Most reliable/);
  });

  it('women-driver filter keeps only verified, top-rated women drivers', () => {
    const r = rentals({ product: 'rental', hours: 8, womenOnly: true }, 2);
    expect(r.options.length).toBeGreaterThan(0);
    expect(r.options.every((o) => o.cab!.womenDriver && o.cab!.rating >= 4.5)).toBe(true);
  });
});

describe('Trips (AI recommender)', () => {
  it('Coorg, 5 people with Amma, 4 bags, ₹10,000 budget: top pick fits and is under budget; 2 sedans rank lower', () => {
    const r = trips({ product: 'trip', days: 3, budget: 10000, elderly: true, bags: 4 }, 5, 'Bangalore', 'Coorg');
    const top = r.options[0];
    expect(top.cab!.seats).toBeGreaterThanOrEqual(5);
    expect(top.price).toBeLessThanOrEqual(10000);
    expect(top.cab!.why).toContain('Under budget');
    const split = r.options.find((o) => o.cab!.splitCars);
    expect(split).toBeDefined();
    expect(r.options.indexOf(split!)).toBeGreaterThan(0);
    expect(WEIGHTS.price + WEIGHTS.fit + WEIGHTS.reliability + WEIGHTS.rating).toBeCloseTo(1);
  });

  it('adds an interstate permit upfront (Bangalore to Wayanad)', () => {
    const r = trips({ product: 'trip', days: 2 }, 2, 'Bangalore', 'Wayanad');
    expect(r.options[0].cab!.lines.some((l) => l.label === 'Kerala permit')).toBe(true);
    expect(r.notes.join(' ')).toMatch(/Kerala permit/);
  });

  it('end to end by voice: one sentence to ranked options with a reason', async () => {
    const a = agent();
    await a.say('Bangalore se Coorg 3 din, 5 log, Amma bhi, 4 bags, budget 10000');
    expect(a.ctx.options[0].cab?.product).toBe('trip');
    expect(a.lastAgent()).toMatch(/AI pick/);
    expect(a.lastAgent()).toMatch(/Why:/);
  });
});

describe('Share (city rules engine)', () => {
  it('Bengaluru blocks private-car paid carpool and offers licensed shared seats instead', () => {
    const r = share({ product: 'share', from: 'HSR', to: 'Whitefield', colleague: true }, 1);
    expect(r.blockedByCityRules).toMatch(/Karnataka/);
    expect(r.options.every((o) => !/colleague/i.test(o.provider))).toBe(true);
    expect(r.options.some((o) => /licensed/i.test(o.serviceNumber))).toBe(true);
  });

  it('Pune allows colleague carpool as a no-profit fuel share', () => {
    const r = share({ product: 'share', from: 'Wakad', to: 'Hinjewadi', colleague: true }, 1);
    expect(r.options.some((o) => o.cab!.costShareRule)).toBe(true);
  });

  it('airport arrivals offer a shared seat in a licensed cab', () => {
    const r = airport({ product: 'airport', direction: 'pickup', flightNumber: '6E 2134' }, 1);
    expect(r.options.some((o) => o.mode === 'carpool' && /licensed/.test(o.serviceNumber))).toBe(true);
  });
});

describe('Guardrails', () => {
  it('no quote id, no fare: a cab option without a quote cannot be booked', async () => {
    const a = agent();
    await a.say('Kal 8 ghante ke liye gaadi chahiye');
    const tampered = { ...a.ctx.options[0], quoteId: undefined };
    a.o.handleSelectOptionExplicitly(tampered);
    await a.say('haan');
    await a.say('Ravi Kumar');
    expect(a.ctx.hold).toBeNull();
    expect(a.lastAgent()).toMatch(/live quote/);
  });

  it('ranking never invents a price: every ranked option keeps its engine quote', () => {
    const r = rentals({ product: 'rental', hours: 4 }, 2);
    const again = rankOptions(r.options, { pax: 2, bags: 2 });
    expect(again.map((o) => o.price).sort()).toEqual(r.options.map((o) => o.price).sort());
  });
});
