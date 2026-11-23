// Paytm Travel Cabs (sandbox): Airport · Rentals · Trips · Share.
//
// Built from the "Paytm Travel Cabs" AI PM case study:
//  - Airport pickups/drops linked to the traveller's flight, fixed fare, "leave by" time,
//    delayed flight moves the pickup at no charge, driver no-show gets a backup in 5 min or a refund.
//  - Rentals (4/8/12 h) compared across verified local cab companies with an AI all-in estimate.
//  - Trips (outstation) ranked by an AI recommender: price vs budget 30%, fit 25%, reliability 25%, rating/safety 20%.
//  - Share: seats in licensed cabs, empty-return legs, colleague carpool only where the city rules engine allows it.
//
// The LLM never writes a fare: every number here comes from this engine and carries a quote id.
// All providers, fares, flights and reliability numbers are SANDBOX / illustrative.

import type { CabMeta, CabProduct, TravelOption } from '../types';

// ---------------------------------------------------------------------------
// Supply: verified local companies + licensed airport taxi (fictional names)
// ---------------------------------------------------------------------------
export interface Provider {
  key: string;
  name: string;
  local: boolean;
  onTimePct: number; // from Paytm's own trip data (illustrative)
  cancelPct: number;
  rating: number;
  womenDrivers: boolean;
  ev: boolean;
  knowsGhats: boolean;
}

export const PROVIDERS: Provider[] = [
  { key: 'sai', name: 'Sai Cabs', local: true, onTimePct: 97, cancelPct: 1.2, rating: 4.7, womenDrivers: false, ev: false, knowsGhats: true },
  { key: 'kaveri', name: 'Kaveri Cabs', local: true, onTimePct: 92, cancelPct: 3.8, rating: 4.4, womenDrivers: false, ev: true, knowsGhats: false },
  { key: 'gardencity', name: 'Garden City Travels', local: true, onTimePct: 95, cancelPct: 2.1, rating: 4.6, womenDrivers: true, ev: false, knowsGhats: true },
  { key: 'nammametro', name: 'Namma Metro Rentals', local: true, onTimePct: 94, cancelPct: 2.6, rating: 4.5, womenDrivers: true, ev: true, knowsGhats: false },
  { key: 'airporttaxi', name: 'Airport Taxi (licensed)', local: false, onTimePct: 96, cancelPct: 1.5, rating: 4.5, womenDrivers: true, ev: true, knowsGhats: false },
];

interface CarType { key: string; label: string; example: string; seats: number; bags: number; perKm: number }
const CARS: Record<string, CarType> = {
  sedan: { key: 'sedan', label: 'Sedan', example: 'Dzire or similar', seats: 4, bags: 3, perKm: 13 },
  ev: { key: 'ev', label: 'EV Sedan', example: 'Tata Tigor EV', seats: 4, bags: 2, perKm: 13 },
  suv: { key: 'suv', label: 'SUV', example: 'Ertiga or similar', seats: 6, bags: 4, perKm: 15 },
  innova: { key: 'innova', label: 'Innova Crysta', example: 'Innova Crysta', seats: 7, bags: 5, perKm: 18 },
};

// ---------------------------------------------------------------------------
// Context the agent already has (in production: Paytm bookings + saved addresses)
// ---------------------------------------------------------------------------
export interface FlightInfo { number: string; from: string; to: string; time: string; kind: 'arrival' | 'departure'; terminal: string }

export const SAVED_HOME = 'Home, HSR Layout';
export const HOME_CITY = 'Bengaluru';

/** Flights the traveller booked on Paytm (sandbox). Arrival = pickup, departure = drop. */
export const PAYTM_FLIGHTS: FlightInfo[] = [
  { number: '6E 2134', from: 'Delhi', to: 'Bengaluru', time: '23:40', kind: 'arrival', terminal: 'Kempegowda Airport, T1' },
  { number: '6E 512', from: 'Bengaluru', to: 'Delhi', time: '08:45', kind: 'departure', terminal: 'Kempegowda Airport, T1' },
];

/** Live flight status (sandbox). Delays are injected by the failure lab / "flight late hai". */
const flightDelays = new Map<string, number>();
export function trackFlight(number: string): FlightInfo & { delayMin: number; status: string; actualTime: string } {
  const f = PAYTM_FLIGHTS.find((x) => x.number.replace(/\s/g, '').toUpperCase() === number.replace(/\s/g, '').toUpperCase())
    ?? { number: number.toUpperCase(), from: 'Delhi', to: 'Bengaluru', time: '22:15', kind: 'arrival' as const, terminal: 'Kempegowda Airport, T1' };
  const delayMin = flightDelays.get(f.number) ?? 0;
  return { ...f, delayMin, status: delayMin >= 15 ? `delayed ${delayMin} min` : 'on time', actualTime: addMinutes(f.time, delayMin) };
}
export function setFlightDelay(number: string, minutes: number) {
  flightDelays.set(number, minutes);
}
export function resetCabsState() {
  flightDelays.clear();
  quoteSeq = 0;
}

// ---------------------------------------------------------------------------
// City rules engine (shared rides)
// ---------------------------------------------------------------------------
const AREA_CITY: Record<string, string> = {
  wakad: 'Pune', hinjewadi: 'Pune', baner: 'Pune', kharadi: 'Pune', 'magarpatta': 'Pune',
  andheri: 'Mumbai', powai: 'Mumbai', bkc: 'Mumbai',
  hsr: 'Bengaluru', 'hsr layout': 'Bengaluru', whitefield: 'Bengaluru', koramangala: 'Bengaluru', 'electronic city': 'Bengaluru',
  indiranagar: 'Bengaluru', yelahanka: 'Bengaluru', 'kia': 'Bengaluru', airport: 'Bengaluru', office: 'Bengaluru',
};
export const CITY_RULES: Record<string, { privateCarpool: boolean; note: string }> = {
  Pune: { privateCarpool: true, note: 'Maharashtra allows app-based, non-profit cost-shared carpool (2025 policy).' },
  Mumbai: { privateCarpool: true, note: 'Maharashtra allows app-based, non-profit cost-shared carpool (2025 policy).' },
  Bengaluru: { privateCarpool: false, note: 'Karnataka has fined private (white-plate) cars used for paid rides, so only seats in licensed yellow-plate cabs are offered.' },
};
export function cityOf(area: string): string | undefined {
  const k = area.trim().toLowerCase();
  return AREA_CITY[k] ?? Object.entries(AREA_CITY).find(([a]) => k.includes(a))?.[1];
}

// ---------------------------------------------------------------------------
// Parsing a cab request from speech (rules; the LLM path fills the same slots)
// ---------------------------------------------------------------------------
export interface CabRequest {
  product: CabProduct;
  direction?: 'pickup' | 'drop';
  flightNumber?: string;
  pickupTime?: string; // HH:MM
  hours?: 4 | 8 | 12;
  plannedKm?: number;
  days?: number;
  budget?: number;
  elderly?: boolean;
  bags?: number;
  womenOnly?: boolean;
  wantsEv?: boolean;
  colleague?: boolean;
  from?: string;
  to?: string;
}

const FLIGHT_RE = /\b(6E|AI|QP|IX|SG|UK)\s?-?(\d{2,4})\b/i;

export function parseCabRequest(text: string): CabRequest | null {
  const t = text.toLowerCase();
  const flight = text.match(FLIGHT_RE);
  const cabWord = /\b(cab|cabs|taxi|car|gaadi|gadi|innova|ertiga|suv|sedan|chauffeur|rental|rent)\b/.test(t);
  const shareWord = /\b(share|shared|sharing|seat|carpool|car pool|pool|empty return|return leg)\b/.test(t);
  const airportWord = /\b(airport|kia|terminal|t1|t2|land(?:s|ing)?|flight)\b/.test(t) || Boolean(flight);
  const hoursM = t.match(/\b(4|8|12|four|eight|twelve|char|aath|baarah)\s*(ghante|ghanta|hours?|hrs?|hr)\b/);
  const fullDay = /\b(poore din|full day|whole day|din bhar)\b/.test(t);
  const daysM = t.match(/\b(\d|two|three|four|five|do|teen|char|paanch)\s*(din|days?)\b/);
  const budgetM = t.match(/(?:budget|under|upto|up to|tak|andar)\s*(?:₹|rs\.?\s?)?(\d[\d,]{2,})|(?:₹|rs\.?\s?)(\d[\d,]{2,})\s*(?:tak|budget|ke andar|under)/);
  const kmM = t.match(/\b(\d{2,3})\s*(?:km|kilometre|kilometer)/);
  const bagsM = t.match(/\b(\d)\s*(?:big\s*)?(?:bags?|suitcases?|bag)\b/);
  const timeM = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)\b/);
  const elderly = /\b(amma|papa|mummy|maa|parents|elderly|senior|dadi|nani|dada|nana|old)\b/.test(t);
  const womenOnly = /\b(women|woman|female|lady|ladies|mahila|akeli)\b/.test(t);
  const wantsEv = /\b(ev|electric)\b/.test(t);
  const colleague = /\b(office|colleague|college|campus|hostel)\b/.test(t);

  let product: CabProduct | null = null;
  if (shareWord) product = 'share';
  else if (airportWord && (cabWord || flight || /\b(ghar|home|pickup|drop|lene|chhodne)\b/.test(t))) product = 'airport';
  else if (cabWord && (hoursM || fullDay || /\b(rental|rent|city mein|shehar mein|local)\b/.test(t))) product = 'rental';
  else if (cabWord) product = 'trip';
  // "Bangalore se Coorg 3 din, 5 log, Amma bhi": a multi-day road trip with no other mode named
  else if (daysM && /\b\w{3,}\s+(se|to)\s+\w{3,}/.test(t) && !/\b(train|flight|bus|hotel|plane|railway)\b/.test(t)) product = 'trip';
  if (!product) return null;

  const req: CabRequest = { product, elderly, womenOnly, wantsEv, colleague };
  if (flight) req.flightNumber = `${flight[1].toUpperCase()} ${flight[2]}`;
  if (product === 'airport') {
    req.direction = /\b(airport se|from (the )?airport|pick ?me|pickup|lene|land|aa rah|arriv)/.test(t) || flight && PAYTM_FLIGHTS.find((f) => f.number === req.flightNumber)?.kind === 'arrival'
      ? 'pickup' : 'drop';
  }
  if (hoursM) {
    const w = hoursM[1];
    req.hours = (['12', 'twelve', 'baarah'].includes(w) ? 12 : ['4', 'four', 'char'].includes(w) ? 4 : 8) as 4 | 8 | 12;
  } else if (product === 'rental') req.hours = fullDay ? 12 : 8;
  if (daysM) {
    const w = daysM[1];
    const words: Record<string, number> = { two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, five: 5, paanch: 5 };
    req.days = /^\d$/.test(w) ? parseInt(w, 10) : words[w];
  }
  if (budgetM) req.budget = parseInt((budgetM[1] ?? budgetM[2]).replace(/,/g, ''), 10);
  if (kmM) req.plannedKm = parseInt(kmM[1], 10);
  if (bagsM) req.bags = parseInt(bagsM[1], 10);
  if (timeM) {
    let h = parseInt(timeM[1], 10) % 12;
    const ap = timeM[3];
    if (ap === 'pm' || (ap === 'baje' && /\b(shaam|raat|evening|night)\b/.test(t))) h += 12;
    if (ap === 'baje' && !/\b(subah|morning|shaam|raat|evening|night)\b/.test(t) && h < 6) h += 12;
    req.pickupTime = `${String(h).padStart(2, '0')}:${timeM[2] ?? '00'}`;
  }
  const route = text.match(/\b([A-Za-z]{3,}(?:\s[A-Za-z]{3,})?)\s+(?:se|to|from)\s+([A-Za-z]{3,}(?:\s[A-Za-z]{3,})?)/i);
  if (route) {
    req.from = route[1].replace(/^(kal|aaj|parso|mujhe|main|hum|i|we|need|book)\s+/i, '');
    req.to = route[2].replace(/\s+(carpool|cab|gaadi|taxi|car|share|seat|kal|aaj)$/i, '');
  }
  return req;
}

/** "flight late hai", "driver nahi aaya": post-booking cab support intents. */
export function parseCabSupport(text: string): { kind: 'flight_delay'; minutes: number } | { kind: 'no_show' } | null {
  const t = text.toLowerCase();
  if (/\bdriver\b/.test(t) && /(nahi aaya|nahi aya|not (here|come|arrived|there)|no.?show|didn'?t come|hasn'?t come|missing)/.test(t)) return { kind: 'no_show' };
  if (/\bflight\b/.test(t) && /(late|delay|der|deri)/.test(t)) {
    const m = t.match(/(\d{1,3})\s*(min|minute|mins|ghanta|hour)/);
    const minutes = m ? (/(ghanta|hour)/.test(m[2]) ? parseInt(m[1], 10) * 60 : parseInt(m[1], 10)) : 45;
    return { kind: 'flight_delay', minutes };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quotes (every option carries a quote id; no quote id, no fare)
// ---------------------------------------------------------------------------
let quoteSeq = 0;
const nextQuoteId = () => `QT${String(++quoteSeq).padStart(4, '0')}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
}

interface Line { label: string; amount: number }

function buildOption(p: Provider, car: CarType, meta: Omit<CabMeta, 'quoteId' | 'providerKey' | 'onTimePct' | 'rating' | 'cancelPct' | 'womenDriver' | 'ev' | 'seats' | 'bags' | 'lines' | 'allIn'>,
  lines: Line[], extra: Partial<TravelOption>): TravelOption {
  const allIn = lines.reduce((s, l) => s + l.amount, 0);
  const quoteId = nextQuoteId();
  const cab: CabMeta = {
    ...meta, quoteId, providerKey: p.key, onTimePct: p.onTimePct, rating: p.rating, cancelPct: p.cancelPct,
    womenDriver: p.womenDrivers, ev: car.key === 'ev', seats: car.seats, bags: car.bags, lines, allIn,
  };
  const inclusions = lines.filter((l) => l.label !== 'Base fare').map((l) => `${l.label.toLowerCase()} ₹${l.amount.toLocaleString('en-IN')}`);
  return {
    id: `cab-${meta.product}-${p.key}-${car.key}-${quoteId}`,
    quoteId,
    cab,
    mode: meta.product === 'share' ? 'carpool' : 'cab',
    provider: `${p.name}${p.local ? ' (local, verified)' : ''}`,
    operator: p.name,
    serviceNumber: `${car.label} · ${car.example}`,
    origin: meta.pickupLabel,
    originCode: 'PICKUP',
    originTerminal: meta.pickupLabel,
    destination: meta.dropLabel,
    destCode: 'DROP',
    destTerminal: meta.dropLabel,
    departureTime: to12h(meta.pickupTime),
    arrivalTime: to12h(addMinutes(meta.pickupTime, meta.rideMinutes)),
    duration: `${Math.floor(meta.rideMinutes / 60)}h ${String(meta.rideMinutes % 60).padStart(2, '0')}m (Door to door)`,
    price: allIn,
    baseFare: lines[0].amount,
    taxesAndFees: allIn - lines[0].amount,
    convenienceFee: 0,
    seatsAvailable: 1 + (p.onTimePct % 3),
    baggage: {
      cabin: `${car.seats} seats · up to ${car.bags} bags`,
      checkIn: inclusions.length ? `${inclusions.join(', ')} are included` : 'one fixed fare, nothing added later',
    },
    cancellation: {
      refundable: true,
      refundSummary: meta.product === 'airport' ? 'Free cancellation until the driver is assigned; flight delays never cost you' : 'Free cancellation until 24h before pickup; 25% within 24h',
      feeBefore24h: 0,
      feeWithin24h: Math.round(allIn / 4),
      penaltyClause: 'Paytm Assured: verified driver, all-in fare, backup cab or refund.',
    },
    convenienceScore: Math.round(p.onTimePct),
    isRecommended: false,
    recommendationTag: '',
    tradeOffDescription: '',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// AI recommender: weights from the case study; adapts to what the traveller says
// ---------------------------------------------------------------------------
export const WEIGHTS = { price: 0.3, fit: 0.25, reliability: 0.25, rating: 0.2 };

export function rankOptions(opts: TravelOption[], ctx: { pax: number; bags: number; budget?: number; elderly?: boolean; womenOnly?: boolean; wantsEv?: boolean; ghats?: boolean }): TravelOption[] {
  if (!opts.length) return opts;
  const prices = opts.map((o) => o.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const scored = opts.map((o) => {
    const m = o.cab!;
    const fitsOne = m.seats >= ctx.pax && m.bags >= ctx.bags;
    const fit = m.splitCars ? 0.4 : fitsOne ? 1 : 0;
    let price = hi === lo ? 1 : 1 - (o.price - lo) / (hi - lo);
    const overBudget = Boolean(ctx.budget && o.price > ctx.budget);
    if (overBudget) price = 0;
    const reliability = (m.onTimePct - 85) / 15 - m.cancelPct / 20;
    let rating = (m.rating - 4) / 1;
    if (ctx.elderly && m.seats >= 7) rating += 0.15; // comfort for an elderly traveller
    if (ctx.ghats && PROVIDERS.find((p) => p.key === m.providerKey)?.knowsGhats) rating += 0.1;
    if (ctx.wantsEv && m.ev) rating += 0.2;
    const score = WEIGHTS.price * price + WEIGHTS.fit * fit + WEIGHTS.reliability * Math.max(0, reliability) + WEIGHTS.rating * Math.min(1.2, Math.max(0, rating)) - (overBudget ? 0.15 : 0);
    const why: string[] = [];
    if (ctx.budget) why.push(o.price <= ctx.budget ? 'Under budget' : 'Over budget');
    if (m.splitCars) why.push('Splits the group into two cars');
    else why.push(fitsOne ? `Fits ${ctx.pax} + ${ctx.bags} bags` : `Too small for ${ctx.pax} + ${ctx.bags} bags`);
    why.push(`${m.onTimePct}% on time`);
    why.push(`${m.rating}★`);
    if (ctx.ghats && PROVIDERS.find((p) => p.key === m.providerKey)?.knowsGhats) why.push('Driver knows the ghats');
    if (m.ev) why.push('EV');
    return { o: { ...o, cab: { ...m, score: Math.round(score * 100), why } }, score, fitsOne };
  });
  let list = scored;
  if (ctx.womenOnly) list = list.filter((s) => s.o.cab!.womenDriver && s.o.cab!.rating >= 4.5);
  list.sort((a, b) => b.score - a.score);
  // Tags shown in the compare view
  const cheapest = [...list].sort((a, b) => a.o.price - b.o.price)[0];
  const reliable = [...list].sort((a, b) => b.o.cab!.onTimePct - a.o.cab!.onTimePct)[0];
  const roomy = [...list].sort((a, b) => b.o.cab!.seats - a.o.cab!.seats || b.o.cab!.bags - a.o.cab!.bags)[0];
  return list.map((s, i) => {
    const tags: string[] = [];
    if (i === 0) tags.push('AI top pick');
    if (s === cheapest) tags.push('Best value');
    if (s === reliable) tags.push('Most reliable');
    if (s === roomy && roomy !== cheapest) tags.push('Most space');
    return { ...s.o, isRecommended: i === 0, recommendationTag: tags.join(' · ') || 'Verified', tradeOffDescription: s.o.cab!.why!.join(' · ') };
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface CabSearchResult {
  product: CabProduct;
  options: TravelOption[];
  headline: string; // grounded summary to speak (amounts only from options)
  notes: string[];
  flight?: ReturnType<typeof trackFlight>;
  leaveBy?: string;
  blockedByCityRules?: string;
}

/** Drive time KIA <-> HSR Layout by hour (sandbox traffic model). */
export function driveMinutes(hhmm: string): number {
  const h = parseInt(hhmm.slice(0, 2), 10);
  return h >= 7 && h < 11 ? 85 : h >= 17 && h < 21 ? 95 : h >= 22 || h < 6 ? 45 : 60;
}

export function airport(req: CabRequest, pax: number): CabSearchResult {
  const flight = req.flightNumber
    ? trackFlight(req.flightNumber)
    : trackFlight((PAYTM_FLIGHTS.find((f) => f.kind === (req.direction === 'pickup' ? 'arrival' : 'departure')) ?? PAYTM_FLIGHTS[0]).number);
  const pickup = req.direction === 'pickup';
  const night = pickup ? parseInt(flight.actualTime, 10) >= 22 || parseInt(flight.actualTime, 10) < 6 : false;
  let pickupTime: string;
  let leaveBy: string | undefined;
  if (pickup) {
    pickupTime = addMinutes(flight.actualTime, 20); // walk to pillar after landing
  } else {
    const recommended = addMinutes(flight.time, -(75 + driveMinutes(addMinutes(flight.time, -120))));
    leaveBy = recommended;
    pickupTime = req.pickupTime ?? recommended;
  }
  const ride = driveMinutes(pickupTime);
  const meta = {
    product: 'airport' as const,
    pickupLabel: pickup ? `${flight.terminal} · Pillar 7` : SAVED_HOME,
    dropLabel: pickup ? SAVED_HOME : flight.terminal,
    pickupTime,
    rideMinutes: ride,
    flightNumber: flight.number,
    flightStatus: flight.status,
    plannedKm: 38,
  };
  const opts: TravelOption[] = [];
  const taxi = PROVIDERS.find((p) => p.key === 'airporttaxi')!;
  const sai = PROVIDERS.find((p) => p.key === 'sai')!;
  const gc = PROVIDERS.find((p) => p.key === 'gardencity')!;
  const sedanBase = pickup ? 1000 : 950;
  opts.push(buildOption(taxi, CARS.sedan, meta, [{ label: 'Base fare', amount: sedanBase }, { label: 'Airport toll and parking', amount: 100 }, ...(night ? [{ label: 'Night charge', amount: 50 }] : [])], {}));
  opts.push(buildOption(sai, CARS.suv, meta, [{ label: 'Base fare', amount: sedanBase + 250 }, { label: 'Airport toll and parking', amount: 100 }, ...(night ? [{ label: 'Night charge', amount: 100 }] : [])], {}));
  if (req.wantsEv || req.womenOnly) opts.push(buildOption(gc, CARS.ev, meta, [{ label: 'Base fare', amount: sedanBase + 80 }, { label: 'Airport toll and parking', amount: 100 }], {}));
  // Private cabs are ranked first; a shared seat is shown after them as the cheaper alternative
  const ranked = rankOptions(opts, { pax, bags: req.bags ?? pax, womenOnly: req.womenOnly, wantsEv: req.wantsEv });
  const top = ranked[0];
  let shareLine = '';
  if (pickup && pax <= 2) {
    const shareMeta = { ...meta, product: 'share' as const, pickupTime: addMinutes(flight.actualTime, 30), dropLabel: 'Whitefield (fixed route, licensed cab)', shared: true };
    const seat = buildOption(taxi, CARS.suv, shareMeta, [{ label: 'Base fare', amount: 450 * pax }], { mode: 'carpool', serviceNumber: 'Shared seat · licensed yellow-plate cab' });
    ranked.push({ ...seat, recommendationTag: 'Cheapest · shared seat', tradeOffDescription: `Leaves ${to12h(shareMeta.pickupTime)} · fixed route to Whitefield` });
    shareLine = ` Or a shared seat in a licensed cab for ₹${seat.price.toLocaleString('en-IN')}.`;
  }
  const flightLine = pickup
    ? `Your flight ${flight.number} lands ${to12h(flight.actualTime)} (${flight.status}). The cab waits at Pillar 7 and tracks your real landing time.`
    : `Your ${to12h(flight.time)} flight ${flight.number} is ${flight.status}.${leaveBy ? ` Leave by ${to12h(leaveBy)}, traffic included.` : ''}`;
  return {
    product: 'airport',
    options: ranked,
    flight,
    leaveBy,
    headline: `${flightLine} Fixed fare ${top ? `₹${top.price.toLocaleString('en-IN')} with ${top.operator}, ${top.serviceNumber.split(' · ')[0]}` : ''}.${shareLine}`,
    notes: night ? ['Book now: airport fares usually rise after 10 pm.', 'Wait under 5 min expected at T1 pickup tonight.'] : ['Fares are steady at this hour.'],
  };
}

export function rentals(req: CabRequest, pax: number): CabSearchResult {
  const hours = req.hours ?? 8;
  const included = hours * 10;
  const planned = req.plannedKm ?? included;
  const extraKm = Math.max(0, planned - included);
  const pickupTime = req.pickupTime ?? '09:00';
  const meta = { product: 'rental' as const, pickupLabel: SAVED_HOME, dropLabel: `${HOME_CITY} · ${hours} hrs / ${included} km`, pickupTime, rideMinutes: hours * 60, hours, kmIncluded: included, plannedKm: planned };
  const bases: Array<[string, keyof typeof CARS, number]> = [
    ['kaveri', 'suv', Math.round((2500 * hours) / 8)],
    ['nammametro', 'suv', Math.round((2740 * hours) / 8)],
    ['sai', 'innova', Math.round((2900 * hours) / 8)],
    ['gardencity', 'innova', Math.round((3500 * hours) / 8)],
    ['nammametro', 'ev', Math.round((2300 * hours) / 8)],
    ['kaveri', 'sedan', Math.round((2000 * hours) / 8)],
  ];
  const opts = bases.map(([pk, ck, base]) => {
    const p = PROVIDERS.find((x) => x.key === pk)!;
    const car = CARS[ck];
    const lines: Line[] = [{ label: 'Base fare', amount: base }];
    if (extraKm) lines.push({ label: `Extra ${extraKm} km`, amount: extraKm * car.perKm });
    lines.push({ label: 'Tolls and parking', amount: 75 });
    return buildOption(p, car, { ...meta, extraKmRate: car.perKm, extraHourRate: Math.round(base / hours) }, lines, {});
  });
  const ranked = rankOptions(opts, { pax, bags: req.bags ?? Math.min(pax, 3), budget: req.budget, womenOnly: req.womenOnly, wantsEv: req.wantsEv, elderly: req.elderly });
  const top = ranked[0];
  return {
    product: 'rental',
    options: ranked,
    headline: `${hours} hours / ${included} km from ${ranked.length} verified local companies.${extraKm ? ` Your plan is about ${planned} km, so the all-in price already adds ${extraKm} extra km plus tolls and parking.` : ''} AI pick: ${top.operator} ${top.serviceNumber.split(' · ')[0]} at ₹${top.price.toLocaleString('en-IN')} all-in.`,
    notes: ['Billing starts at your pickup, not their garage.', 'A live meter shows hours and km left, with the cost.'],
  };
}

const TRIP_KM: Record<string, { km: number; state: string }> = {
  coorg: { km: 265, state: 'Karnataka' }, mysuru: { km: 145, state: 'Karnataka' }, mysore: { km: 145, state: 'Karnataka' },
  ooty: { km: 270, state: 'Tamil Nadu' }, wayanad: { km: 280, state: 'Kerala' }, chikmagalur: { km: 245, state: 'Karnataka' },
  pondicherry: { km: 310, state: 'Puducherry' }, puducherry: { km: 310, state: 'Puducherry' }, hampi: { km: 340, state: 'Karnataka' },
  mahabaleshwar: { km: 120, state: 'Maharashtra' }, lonavala: { km: 65, state: 'Maharashtra' }, nandi: { km: 60, state: 'Karnataka' },
};
const ORIGIN_STATE: Record<string, string> = { bengaluru: 'Karnataka', bangalore: 'Karnataka', pune: 'Maharashtra', mumbai: 'Maharashtra' };

export function trips(req: CabRequest, pax: number, origin: string, destination: string): CabSearchResult {
  const dKey = destination.trim().toLowerCase();
  const info = TRIP_KM[dKey] ?? { km: 180, state: 'Karnataka' };
  const days = req.days ?? 1;
  const roundTrip = days > 1;
  const totalKm = roundTrip ? Math.max(2 * info.km + 40 * (days - 1), 250 * days) : info.km;
  const oState = ORIGIN_STATE[origin.trim().toLowerCase()] ?? 'Karnataka';
  const permit = info.state !== oState ? Math.round(400 + days * 100) : 0;
  const pickupTime = req.pickupTime ?? '06:00';
  const bags = req.bags ?? pax;
  const meta = {
    product: 'trip' as const, pickupLabel: `Your address in ${origin}`, dropLabel: roundTrip ? `${destination} and back · ${days} days` : `Your address in ${destination}`,
    pickupTime, rideMinutes: Math.round((info.km / 50) * 60), days, plannedKm: totalKm, kmIncluded: totalKm,
    permitNote: permit ? `${info.state} permit added upfront` : undefined,
  };
  const make = (pk: string, ck: keyof typeof CARS, rate: number) => {
    const p = PROVIDERS.find((x) => x.key === pk)!;
    const car = CARS[ck];
    const lines: Line[] = [{ label: 'Base fare', amount: Math.round(totalKm * rate) }, { label: 'Driver allowance', amount: 400 * days }, { label: 'Tolls', amount: Math.round(info.km / 60) * 85 * (roundTrip ? 2 : 1) }];
    if (permit) lines.push({ label: `${info.state} permit`, amount: permit });
    return buildOption(p, car, { ...meta, extraKmRate: car.perKm }, lines, {});
  };
  const opts: TravelOption[] = [];
  if (pax <= 4 && bags <= 3) opts.push(make('kaveri', 'sedan', 9.5), make('gardencity', 'sedan', 10));
  if (pax <= 6) opts.push(make('nammametro', 'suv', 10.5));
  opts.push(make('kaveri', 'innova', 10.2), make('sai', 'innova', 11));
  if (pax > 4) {
    const s1 = make('gardencity', 'sedan', 10);
    const twoCars = s1.cab!.lines.map((l) => ({ ...l, amount: l.amount * 2 }));
    const split = buildOption(PROVIDERS.find((x) => x.key === 'gardencity')!, { ...CARS.sedan, seats: 8, bags: 6, label: '2 sedans' }, { ...meta, extraKmRate: CARS.sedan.perKm, splitCars: true }, twoCars, {});
    opts.push(split);
  }
  const ranked = rankOptions(opts, { pax, bags, budget: req.budget, elderly: req.elderly, womenOnly: req.womenOnly, wantsEv: req.wantsEv, ghats: ['coorg', 'ooty', 'wayanad', 'chikmagalur', 'mahabaleshwar'].includes(dKey) });
  const top = ranked[0];
  return {
    product: 'trip',
    options: ranked,
    headline: `${roundTrip ? `${days}-day round trip` : 'One-way'} ${origin} to ${destination} for ${pax}. AI pick: ${top.operator} ${top.serviceNumber.split(' · ')[0]} at ₹${top.price.toLocaleString('en-IN')} all-in. Why: ${top.cab!.why!.slice(0, 3).join(', ')}.`,
    notes: [
      ...(permit ? [`${info.state} permit is added upfront, so there's no surprise at the border.`] : []),
      'Driver details arrive the day before. No-show? A backup cab or a refund.',
      'Book Tue or Wed to save more on weekend trips.',
    ],
  };
}

export function share(req: CabRequest, pax: number): CabSearchResult {
  const from = req.from ?? 'HSR Layout';
  const to = req.to ?? 'Office';
  const city = cityOf(from) ?? cityOf(to) ?? HOME_CITY;
  const rules = CITY_RULES[city] ?? CITY_RULES.Bengaluru;
  const pickupTime = req.pickupTime ?? '09:00';
  const base = { product: 'share' as const, pickupLabel: `${from}, ${city}`, dropLabel: `${to}, ${city}`, pickupTime, rideMinutes: 45, shared: true };
  const opts: TravelOption[] = [];
  let blocked: string | undefined;
  if (req.colleague || /carpool|pool/.test(`${req.from} ${req.to}`) || rules.privateCarpool) {
    if (rules.privateCarpool) {
      const km = 14;
      for (const [i, pk] of (['gardencity', 'sai'] as const).entries()) {
        const p = { ...PROVIDERS.find((x) => x.key === pk)!, name: i === 0 ? 'Priya S. (verified colleague)' : 'Rohit K. (verified colleague)', local: false };
        const offered = i === 0 ? 3 : 2;
        const shareAmt = Math.ceil((km * 7) / (offered + 1)) * pax;
        opts.push(buildOption(p, { ...CARS.sedan, label: 'Colleague carpool', example: i === 0 ? 'Hyundai i20' : 'Tata Nexon' },
          { ...base, pickupTime: addMinutes(pickupTime, i === 0 ? -15 : 0), plannedKm: km, costShareRule: `₹7 per km × ${km} km ÷ ${offered + 1} people, no profit` },
          [{ label: 'Base fare', amount: shareAmt }], { mode: 'carpool', serviceNumber: `Colleague carpool · ${i === 0 ? 'Hyundai i20' : 'Tata Nexon'}` }));
      }
    } else blocked = rules.note;
  }
  if (!rules.privateCarpool || opts.length === 0) {
    const taxi = PROVIDERS.find((p) => p.key === 'airporttaxi')!;
    opts.push(buildOption({ ...taxi, name: 'Licensed shared cab' }, CARS.suv, { ...base, pickupTime: addMinutes(pickupTime, -10) }, [{ label: 'Base fare', amount: 180 * pax }], { mode: 'carpool', serviceNumber: 'Seat in licensed yellow-plate cab · fixed route' }));
    const sai = PROVIDERS.find((p) => p.key === 'sai')!;
    opts.push(buildOption(sai, CARS.innova, { ...base, pickupLabel: 'Coorg', dropLabel: `${HOME_CITY} (empty return leg)`, rideMinutes: 330, pickupTime: '15:00' }, [{ label: 'Base fare', amount: 650 * pax }], { mode: 'carpool', serviceNumber: 'Empty return seat · Innova Crysta' }));
  }
  const ranked = rankOptions(opts, { pax, bags: pax, womenOnly: req.womenOnly });
  return {
    product: 'share',
    options: ranked,
    blockedByCityRules: blocked,
    headline: rules.privateCarpool
      ? `Colleague carpool in ${city}: a fuel cost share, no profit. ${ranked.length} verified rides near ${to12h(pickupTime)}.`
      : `${blocked ? `${blocked} ` : ''}I found ${ranked.length} shared seats in licensed cabs.`,
    notes: [rules.note],
  };
}

// ---------------------------------------------------------------------------
// AI-driven insights (illustrative data)
// ---------------------------------------------------------------------------
export const BEST_DAY_TO_BOOK = [
  { day: 'Mon', fare: 9400 }, { day: 'Tue', fare: 8900 }, { day: 'Wed', fare: 8950 }, { day: 'Thu', fare: 9300 },
  { day: 'Fri', fare: 9900 }, { day: 'Sat', fare: 10200 }, { day: 'Sun', fare: 9800 },
];
export const OPERATOR_DEMAND = [
  { hour: '8p', flyers: 120 }, { hour: '9p', flyers: 160 }, { hour: '10p', flyers: 210 }, { hour: '11p', flyers: 340 },
  { hour: '12a', flyers: 310 }, { hour: '1a', flyers: 180 }, { hour: '2a', flyers: 90 },
];
export function operatorAdvice(): string {
  const peak = OPERATOR_DEMAND.filter((d) => d.flyers >= 300).map((d) => d.hour);
  return `Keep 8 cars near Yelahanka, ${peak[0] ?? '11p'}–1a (Paytm flyers landing at KIA, Friday).`;
}
export function noShowRisk(o: TravelOption): 'Low' | 'Medium' | 'High' {
  const c = o.cab;
  if (!c) return 'Low';
  const nightPenalty = parseInt(c.pickupTime, 10) >= 22 ? 1 : 0;
  const r = c.cancelPct + nightPenalty;
  return r < 2.5 ? 'Low' : r < 4 ? 'Medium' : 'High';
}

/** Backup provider for a no-show: next best on reliability, never the same company. */
export function backupFor(o: TravelOption): Provider | undefined {
  return PROVIDERS.filter((p) => p.key !== o.cab?.providerKey && p.key !== 'airporttaxi').sort((a, b) => b.onTimePct - a.onTimePct)[0];
}

export function defaultTripDate(): string {
  return tomorrowISO();
}
