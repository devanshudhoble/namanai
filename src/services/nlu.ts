// Natural-language understanding layer.
//
// Two interchangeable engines produce the SAME `Understanding` shape:
//   1. LLM (Gemini 2.5 Flash, server-side, JSON-schema constrained)  -> primary
//   2. Deterministic rules (this file)                                -> fallback / offline / eval baseline
//
// The LLM only *understands*. It never decides prices, availability or PNRs.
// Those come from tools and are spoken via templates (see contextHarness.ts).

export type Intent =
  | 'trip_details'
  | 'ask_cheaper'
  | 'ask_fastest'
  | 'ask_morning'
  | 'select_option'
  | 'approve'
  | 'decline'
  | 'give_name'
  | 'ask_baggage'
  | 'ask_cancellation_policy'
  | 'cancel_booking'
  | 'payment_issue'
  | 'payment_failed'
  | 'shift_date'
  | 'booking_status'
  | 'greeting'
  | 'other';

export const INTENTS: Intent[] = [
  'trip_details', 'ask_cheaper', 'ask_fastest', 'ask_morning', 'select_option', 'approve', 'decline',
  'give_name', 'ask_baggage', 'ask_cancellation_policy', 'cancel_booking', 'payment_issue',
  'payment_failed', 'shift_date', 'booking_status', 'greeting', 'other',
];

export type ModePref = 'flight' | 'train' | 'bus' | 'hotel' | 'all';

export interface ExtractedSlots {
  destination?: string;
  origin?: string;
  dateISO?: string; // YYYY-MM-DD
  passengers?: number;
  mode?: ModePref;
  tripType?: 'one-way' | 'return';
  travelClass?: string; // 3AC, 2AC, Sleeper ...
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'night';
  budget?: number;
  passengerName?: string;
}

export interface Understanding {
  intent: Intent;
  slots: ExtractedSlots;
  selection?: { mode?: 'flight' | 'train' | 'bus' | 'hotel'; index?: number };
  dateShiftDays?: number;
  /** Optional free text from the LLM for small talk. Must pass the grounding validator before being spoken. */
  reply?: string;
  source: 'llm' | 'rules';
}

export interface DialogueState {
  activeQuestion: string;
  hasOptions: boolean;
  awaitingApproval: boolean;
  awaitingCancelConfirm: boolean;
  hasConfirmedBooking: boolean;
  hasPendingPayment: boolean;
  today: Date;
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

const CITY_ALIASES: Record<string, string> = {
  jodpur: 'jodhpur', bombay: 'mumbai', bangalore: 'bengaluru', bengalore: 'bengaluru', calcutta: 'kolkata',
  madras: 'chennai', cochin: 'kochi', banaras: 'varanasi', kashi: 'varanasi', baroda: 'vadodara',
  poona: 'pune', trivandrum: 'thiruvananthapuram', vizag: 'visakhapatnam', mysore: 'mysuru',
  prayag: 'prayagraj', allahabad: 'prayagraj', gurgaon: 'gurugram', simla: 'shimla', dilli: 'delhi',
  amritser: 'amritsar', pondicherry: 'puducherry', 'new delhi': 'delhi',
};

export const KNOWN_LOCATIONS = [
  'mumbai', 'navi mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'pune', 'hyderabad', 'chennai', 'kolkata',
  'ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'varanasi', 'bhopal', 'indore', 'patna', 'surat', 'kochi',
  'cochin', 'goa', 'amritsar', 'manali', 'shimla', 'dehradun', 'ayodhya', 'shirdi', 'haridwar', 'rishikesh',
  'udaipur', 'jodhpur', 'jodpur', 'agra', 'nagpur', 'vadodara', 'baroda', 'coimbatore', 'visakhapatnam', 'vizag',
  'ranchi', 'raipur', 'guwahati', 'bhubaneswar', 'wardha', 'amravati', 'solapur', 'nashik', 'latur', 'nanded',
  'kolhapur', 'mysore', 'mysuru', 'mangalore', 'kannur', 'kozhikode', 'thiruvananthapuram', 'trivandrum',
  'madurai', 'tirupati', 'vijayawada', 'guntur', 'salem', 'trichy', 'pondicherry', 'puducherry', 'darjeeling',
  'gangtok', 'shillong', 'siliguri', 'dhanbad', 'jamshedpur', 'gwalior', 'jabalpur', 'ujjain', 'kanpur',
  'prayagraj', 'allahabad', 'meerut', 'bareilly', 'gurugram', 'gurgaon', 'noida', 'srinagar', 'jammu', 'leh',
  'ooty', 'bombay', 'calcutta', 'madras', 'dilli', 'banaras', 'kashi', 'poona', 'simla', 'kerala', 'kashmir',
  'rajasthan', 'ladakh',
];

const NOT_A_CITY = new Set([
  'yes', 'no', 'hi', 'hello', 'namaste', 'ok', 'okay', 'train', 'bus', 'flight', 'hotel', 'haan', 'nahi', 'sure',
  'thanks', 'thank', 'please', 'book', 'cancel', 'one', 'two', 'return', 'oneway', 'today', 'tomorrow', 'kal',
  'parso', 'me', 'i', 'want', 'to', 'go', 'the', 'a', 'travel', 'trip', 'ticket', 'help', 'morning', 'evening',
  'cheaper', 'fastest', 'sasta', 'select', 'option', 'what', 'my', 'is', 'from', 'se', 'jana', 'hai',
]);

export function normalizeCity(raw: string): string {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const resolved = CITY_ALIASES[clean] || clean;
  return resolved
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface CityHit {
  city: string;
  start: number;
  end: number;
}

function findKnownCities(lower: string): CityHit[] {
  const hits: CityHit[] = [];
  const sorted = [...KNOWN_LOCATIONS].sort((a, b) => b.length - a.length); // longest first ("navi mumbai" before "mumbai")
  for (const city of sorted) {
    const re = new RegExp(`\\b${city}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const overlaps = hits.some((h) => m!.index < h.end && m!.index + city.length > h.start);
      if (!overlaps) hits.push({ city, start: m.index, end: m.index + city.length });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function isOriginMarked(lower: string, hit: CityHit): boolean {
  const before = lower.slice(Math.max(0, hit.start - 15), hit.start);
  const after = lower.slice(hit.end, hit.end + 6);
  return /\b(from|leaving|starting|ex)\s*$/.test(before) || /^\s+se\b/.test(after);
}

function isDestMarked(lower: string, hit: CityHit): boolean {
  const before = lower.slice(Math.max(0, hit.start - 10), hit.start);
  const after = lower.slice(hit.end, hit.end + 12);
  return /\b(to|for|towards|reach|visit)\s*$/.test(before) || /^\s+(tak|jana|jaana|ke liye|pahunchna)\b/.test(after);
}

export function extractCities(text: string, activeQuestion?: string): { origin?: string; destination?: string } {
  const lower = text.toLowerCase();
  const hits = findKnownCities(lower);

  if (hits.length >= 2) {
    const [a, b] = hits;
    if (isOriginMarked(lower, b) || isDestMarked(lower, a)) {
      return { origin: normalizeCity(b.city), destination: normalizeCity(a.city) };
    }
    return { origin: normalizeCity(a.city), destination: normalizeCity(b.city) };
  }

  if (hits.length === 1) {
    const h = hits[0];
    const city = normalizeCity(h.city);
    if (isOriginMarked(lower, h)) return { origin: city };
    if (isDestMarked(lower, h)) return { destination: city };
    return activeQuestion === 'origin' ? { origin: city } : { destination: city };
  }

  // Unknown towns/villages: "to Pachmarhi", "from Wardha", or a bare 1-2 word answer to a city question
  const toM = text.match(/\b(?:to|for|reach|visit)\s+([A-Za-z]{3,}(?:\s[A-Za-z]{3,})?)/i);
  const fromM = text.match(/\bfrom\s+([A-Za-z]{3,})/i) || text.match(/\b([A-Za-z]{3,})\s+se\b/i);
  const out: { origin?: string; destination?: string } = {};
  if (toM && !NOT_A_CITY.has(toM[1].toLowerCase().split(' ')[0])) out.destination = normalizeCity(toM[1]);
  if (fromM && !NOT_A_CITY.has(fromM[1].toLowerCase())) out.origin = normalizeCity(fromM[1]);
  if (out.origin || out.destination) return out;

  if (activeQuestion === 'destination' || activeQuestion === 'origin') {
    const words = text.trim().replace(/[.!?,]/g, '').split(/\s+/);
    if (words.length <= 2 && words.every((w) => /^[A-Za-z]{3,}$/.test(w) && !NOT_A_CITY.has(w.toLowerCase()))) {
      const city = normalizeCity(words.join(' '));
      return activeQuestion === 'origin' ? { origin: city } : { destination: city };
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Dates (Indian English + Hinglish)
// ---------------------------------------------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10,
  november: 10, dec: 11, december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, ravivar: 0, itwar: 0, monday: 1, somwar: 1, somvar: 1, tuesday: 2, mangalwar: 2,
  wednesday: 3, budhwar: 3, thursday: 4, guruwar: 4, veervar: 4, friday: 5, shukrawar: 5,
  saturday: 6, shaniwar: 6,
};

/**
 * Parses spoken dates relative to `today`. Returns ISO date or null.
 * Handles: today/aaj, tomorrow/kal, parso, this weekend, (next|agle) friday/shukrawar,
 * "4", "4th", "4 tarikh", "4 nov", "nov 4", "4/11".
 * `bareNumberAllowed` must be true for a lone "4" to count as a date (avoids clashing with passenger count).
 */
export function parseIndianDate(text: string, today: Date = new Date(), bareNumberAllowed = false): string | null {
  const lower = text.toLowerCase().trim();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const plus = (n: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };

  if (/\b(day after tomorrow|parso|parson)\b/.test(lower)) return plus(2);
  if (/\b(today|aaj|tonight)\b/.test(lower)) return plus(0);
  if (/\b(tomorrow|kal)\b/.test(lower)) return plus(1);
  if (/\b(this weekend|weekend)\b/.test(lower)) {
    const diff = (6 - base.getDay() + 7) % 7 || 7;
    return plus(diff);
  }

  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      const isNext = /\b(next|agle|agla|agli)\b/.test(lower);
      let diff = (dow - base.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      // "next friday" said on a Monday means the Friday of next week in common Indian usage
      if (isNext && diff < 7 && base.getDay() !== 0 && dow > base.getDay()) diff += 7;
      return plus(diff);
    }
  }

  // "4 nov", "4th november", "nov 4"
  const dm = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([a-z]{3,9})\b/);
  const md = lower.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  const pick = (day: number, monthName: string) => {
    const month = MONTHS[monthName];
    if (month === undefined || day < 1 || day > 31) return null;
    let year = base.getFullYear();
    if (new Date(year, month, day) < base) year += 1;
    return toISODate(new Date(year, month, day));
  };
  if (dm && MONTHS[dm[2]] !== undefined) return pick(parseInt(dm[1], 10), dm[2]);
  if (md && MONTHS[md[1]] !== undefined) return pick(parseInt(md[2], 10), md[1]);

  // "4/11" or "4-11" (DD/MM, Indian format)
  const slash = lower.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year = base.getFullYear();
      if (new Date(year, month, day) < base) year += 1;
      return toISODate(new Date(year, month, day));
    }
  }

  // "4th", "4 tarikh", "on the 4th", or bare "4" when we just asked for a date
  const ordinal = lower.match(/\b(\d{1,2})(st|nd|rd|th)\b/) || lower.match(/\b(\d{1,2})\s*(tarikh|tareekh|ko)\b/);
  const bare = bareNumberAllowed ? lower.match(/^(?:on\s+)?(\d{1,2})$/) : null;
  const dayMatch = ordinal || bare;
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      let month = base.getMonth();
      let year = base.getFullYear();
      if (day < base.getDate()) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      return toISODate(new Date(year, month, day));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Passengers, mode, class, time
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4, five: 5, paanch: 5, panch: 5,
  six: 6, chhe: 6, seven: 7, saat: 7, eight: 8, aath: 8, nine: 9, nau: 9,
};

export function extractPassengers(text: string, bareNumberAllowed = false): number | undefined {
  const lower = text.toLowerCase();
  if (/\b(just me|only me|solo|alone|akela|akeli|myself|sirf main)\b/.test(lower)) return 1;
  if (/\b(couple|me and my (wife|husband|partner)|hum dono|we two)\b/.test(lower)) return 2;
  const m = lower.match(
    /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ek|do|teen|char|chaar|paanch|panch|chhe|saat|aath|nau)\s*(people|persons|person|pax|passengers?|travell?ers?|adults?|log|logon|tickets?|seats?|members?|of us)\b/
  );
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]];
    if (n >= 1 && n <= 9) return n;
  }
  if (bareNumberAllowed) {
    const bare = lower.trim().match(/^(\d{1,2}|one|two|three|four|five|six|seven|eight|nine)$/);
    if (bare) {
      const n = /^\d+$/.test(bare[1]) ? parseInt(bare[1], 10) : NUMBER_WORDS[bare[1]];
      if (n >= 1 && n <= 9) return n;
    }
  }
  return undefined;
}

export function extractMode(lower: string): ModePref | undefined {
  if (/\b(flight|flights|plane|fly|hawai|airline|indigo|akasa|air india)\b/.test(lower)) return 'flight';
  if (/\b(train|trains|railway|irctc|rail|3ac|2ac|1ac|3 ac|2 ac|chair car|vande bharat)\b/.test(lower)) return 'train';
  if (/\b(bus|buses|volvo|sleeper bus)\b/.test(lower)) return 'bus';
  if (/\b(hotel|hotels|stay|resort)\b/.test(lower)) return 'hotel';
  if (/\b(anything|any mode|all options|sab|kuch bhi|whatever is cheapest)\b/.test(lower)) return 'all';
  return undefined;
}

function extractClass(lower: string): string | undefined {
  if (/\b(3ac|3 ac|third ac|3a)\b/.test(lower)) return '3AC';
  if (/\b(2ac|2 ac|second ac|2a)\b/.test(lower)) return '2AC';
  if (/\bsleeper class\b|\bsl class\b|(\bsleeper\b(?!\s*bus))/.test(lower) && !/\bbus\b/.test(lower)) return 'Sleeper';
  return undefined;
}

function extractTime(lower: string): ExtractedSlots['timePreference'] {
  if (/\b(morning|subah|early)\b/.test(lower)) return 'morning';
  if (/\b(afternoon|dopahar)\b/.test(lower)) return 'afternoon';
  if (/\b(evening|shaam)\b/.test(lower)) return 'evening';
  if (/\b(night|raat|overnight)\b/.test(lower)) return 'night';
  return undefined;
}

function extractBudget(lower: string): number | undefined {
  const m = lower.match(/(?:under|below|budget|within|max|upto|up to|less than)\s*(?:of\s*)?(?:₹|rs\.?|inr)?\s*(\d[\d,]*)\s*(k)?/);
  if (!m) return undefined;
  let n = parseInt(m[1].replace(/,/g, ''), 10);
  if (m[2]) n *= 1000;
  return n >= 100 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

const APPROVE = /\b(yes|yeah|yep|haan|haa|ha|ji|sure|proceed|confirm|go ahead|book it|kar do|kardo|karo|ok|okay|theek hai|thik hai|done|please do)\b/;
const DECLINE = /\b(no|nope|nahi|nahin|mat|don't|do not|not now|wait|ruko|stop|later)\b/;

export function rulesUnderstand(text: string, state: DialogueState): Understanding {
  const lower = text.toLowerCase().trim();
  const u = (intent: Intent, extra: Partial<Understanding> = {}): Understanding => ({
    intent,
    slots: {},
    source: 'rules',
    ...extra,
  });

  // --- Support / payment intents first: they can arrive at any point in the journey ---
  if (/(deducted|debited|cut gaya|kat gaya|kat gaye|paise kat|money (got )?cut|ticket (is )?pending|not confirmed|pending ticket)/.test(lower)) {
    return u('payment_issue');
  }
  if (/(payment (failed|declined|didn't go|did not go|nahi hua)|transaction failed|declined|failed on)/.test(lower)) {
    return u('payment_failed');
  }
  if (/\bcancel\b/.test(lower) && /\b(booking|ticket|flight|train|bus|trip|my)\b/.test(lower) && state.hasConfirmedBooking) {
    return u('cancel_booking');
  }
  if (/(baggage|luggage|check-in|checkin|cabin bag|\bkg\b)/.test(lower)) return u('ask_baggage');
  if (/(cancellation|refund|cancel policy|cancellation policy|rules)/.test(lower)) return u('ask_cancellation_policy');
  if (/(booking status|my trips|my booking|where is my ticket)/.test(lower)) return u('booking_status');

  // --- Confirmation turns ---
  if (state.awaitingApproval || state.awaitingCancelConfirm) {
    if (DECLINE.test(lower)) return u('decline');
    if (APPROVE.test(lower)) return u('approve');
  }

  if (state.activeQuestion === 'name') {
    const nm = text.match(/(?:my name is|name is|mera naam|i am|i'm|passenger is|naam)\s+([A-Za-z][A-Za-z .]{1,40})/i);
    const raw = (nm ? nm[1] : text).replace(/\b(hai|he|is)\b\.?$/i, '').trim();
    if (/^[A-Za-z][A-Za-z .]{1,40}$/.test(raw)) {
      return u('give_name', { slots: { passengerName: raw.replace(/\s+/g, ' ') } });
    }
  }

  // --- Slots (multi-slot: one sentence can fill everything) ---
  const slots: ExtractedSlots = {};
  const cities = extractCities(text, state.activeQuestion);
  if (cities.destination) slots.destination = cities.destination;
  if (cities.origin) slots.origin = cities.origin;
  const date = parseIndianDate(text, state.today, state.activeQuestion === 'date');
  if (date) slots.dateISO = date;
  const pax = extractPassengers(text, state.activeQuestion === 'passengers');
  if (pax) slots.passengers = pax;
  const mode = extractMode(lower);
  if (mode) slots.mode = mode;
  const cls = extractClass(lower);
  if (cls) {
    slots.travelClass = cls;
    slots.mode = 'train';
  }
  if (/\b(one[- ]?way|single|sirf jana)\b/.test(lower)) slots.tripType = 'one-way';
  else if (/\b(return|round[- ]?trip|both ways|wapas|aana jaana)\b/.test(lower)) slots.tripType = 'return';
  const time = extractTime(lower);
  if (time) slots.timePreference = time;
  const budget = extractBudget(lower);
  if (budget) slots.budget = budget;

  // --- Option-stage intents ---
  if (state.hasOptions) {
    if (/(cheaper|cheapest|sasta|sabse sasta|lowest|budget option|kam price|less expensive)/.test(lower)) return u('ask_cheaper', { slots });
    if (/(fastest|quickest|jaldi|shortest|least time)/.test(lower)) return u('ask_fastest', { slots });
    if (/(one day later|next day|ek din baad|day after|shift.*(day|date)|agle din)/.test(lower)) {
      return u('shift_date', { slots, dateShiftDays: 1 });
    }
    if (/(one day earlier|day before|ek din pehle)/.test(lower)) return u('shift_date', { slots, dateShiftDays: -1 });
    const idx = lower.match(/\boption\s*(\d)\b|\b(first|second|third|pehla|doosra|teesra)\b/);
    const selectWords = /(select|choose|book|go with|lock|le lo|chahiye|this one|that one)/.test(lower);
    if (idx || (selectWords && (mode || cls))) {
      const ordinals: Record<string, number> = { first: 1, pehla: 1, second: 2, doosra: 2, third: 3, teesra: 3 };
      const index = idx ? (idx[1] ? parseInt(idx[1], 10) : ordinals[idx[2]]) : undefined;
      const selMode = mode && mode !== 'all' ? mode : undefined;
      return u('select_option', { slots, selection: { index, mode: selMode } });
    }
    if (time === 'morning' && !slots.destination && !slots.dateISO) return u('ask_morning', { slots });
  }

  const filled = Object.keys(slots).length;
  if (filled > 0) return u('trip_details', { slots });
  if (/^(hi|hello|hey|namaste|namaskar|hii+)\b/.test(lower)) return u('greeting');
  return u('other');
}

export function countSlots(slots: ExtractedSlots): number {
  return Object.values(slots).filter((v) => v !== undefined && v !== null && v !== '').length;
}
