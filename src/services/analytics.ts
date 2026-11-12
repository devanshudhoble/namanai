// Journey analytics: every number shown in the Insights drawer is computed from these events.
// Nothing is hardcoded. Events persist in this browser (localStorage) so the funnel
// accumulates across demo sessions; in production these would stream to the event pipeline.

export const FUNNEL_STAGES = [
  'session_started',
  'trip_details_complete',
  'options_shown',
  'option_selected',
  'booking_approved',
  'payment_requested',
  'booking_confirmed',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  session_started: 'Conversation started',
  trip_details_complete: 'Trip details captured',
  options_shown: 'Options shown',
  option_selected: 'Option selected',
  booking_approved: 'Customer approved booking',
  payment_requested: 'UPI payment requested',
  booking_confirmed: 'Ticket confirmed',
};

export type EventName =
  | FunnelStage
  | 'user_turn'
  | 'nlu_result'
  | 'payment_failed'
  | 'payment_retry'
  | 'reconciliation_run'
  | 'refund_initiated'
  | 'cancellation_completed'
  | 'credential_blocked'
  | 'ungrounded_claim_blocked'
  | 'session_abandoned'
  | 'timing';

export interface AnalyticsEvent {
  name: EventName;
  sessionId: string;
  ts: number;
  props?: Record<string, string | number | boolean | null>;
}

const STORAGE_KEY = 'voyai.analytics.v1';
const MAX_EVENTS = 3000;

function newSessionId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private sessionId = newSessionId();
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) this.events = JSON.parse(raw);
    } catch {
      this.events = [];
    }
  }

  private persist() {
    try {
      if (this.events.length > MAX_EVENTS) this.events = this.events.slice(-MAX_EVENTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      /* storage unavailable: keep in memory only */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSessionId() {
    return this.sessionId;
  }

  track(name: EventName, props?: AnalyticsEvent['props']) {
    // Funnel stages are counted once per session
    if ((FUNNEL_STAGES as readonly string[]).includes(name)) {
      const already = this.events.some((e) => e.sessionId === this.sessionId && e.name === name);
      if (already) return;
    }
    this.events.push({ name, sessionId: this.sessionId, ts: Date.now(), props });
    this.persist();
  }

  timing(metric: 'nlu_ms' | 'tool_ms' | 'tts_ms' | 'turn_ms', ms: number) {
    this.track('timing', { metric, ms: Math.round(ms) });
  }

  /** Ends the current session (records where the user dropped off if no booking) and starts a new one. */
  newSession() {
    const mine = this.events.filter((e) => e.sessionId === this.sessionId);
    const reached = FUNNEL_STAGES.filter((s) => mine.some((e) => e.name === s));
    const hadTurns = mine.some((e) => e.name === 'user_turn');
    if (hadTurns && !reached.includes('booking_confirmed')) {
      this.track('session_abandoned', { lastStage: reached[reached.length - 1] ?? 'session_started' });
    }
    this.sessionId = newSessionId();
  }

  clearAll() {
    this.events = [];
    this.sessionId = newSessionId();
    this.persist();
  }

  getEvents() {
    return this.events;
  }

  summary() {
    return summarize(this.events);
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

function p90(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]);
}

export function summarize(events: AnalyticsEvent[]) {
  const sessions = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    if (!sessions.has(e.sessionId)) sessions.set(e.sessionId, []);
    sessions.get(e.sessionId)!.push(e);
  }
  const engaged = [...sessions.values()].filter((evs) => evs.some((e) => e.name === 'user_turn'));

  const funnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    label: FUNNEL_LABELS[stage],
    sessions: engaged.filter((evs) => evs.some((e) => e.name === stage)).length,
  }));

  // Turns needed before options were shown (lower = less friction)
  const turnsToOptions: number[] = [];
  for (const evs of engaged) {
    const shownAt = evs.find((e) => e.name === 'options_shown')?.ts;
    if (shownAt) turnsToOptions.push(evs.filter((e) => e.name === 'user_turn' && e.ts <= shownAt).length);
  }

  const nlu = events.filter((e) => e.name === 'nlu_result');
  const llmShare = nlu.length ? nlu.filter((e) => e.props?.source === 'llm').length / nlu.length : null;
  const slotsPerTurn = nlu.length
    ? nlu.reduce((a, e) => a + Number(e.props?.slotsFilled ?? 0), 0) / nlu.length
    : null;

  const timingsOf = (metric: string) =>
    events.filter((e) => e.name === 'timing' && e.props?.metric === metric).map((e) => Number(e.props?.ms));

  const latency = (['nlu_ms', 'tool_ms', 'tts_ms', 'turn_ms'] as const).map((m) => ({
    metric: m,
    median: median(timingsOf(m)),
    p90: p90(timingsOf(m)),
    samples: timingsOf(m).length,
  }));

  const dropOffs: Record<string, number> = {};
  for (const e of events.filter((e) => e.name === 'session_abandoned')) {
    const k = String(e.props?.lastStage ?? 'unknown');
    dropOffs[k] = (dropOffs[k] ?? 0) + 1;
  }

  const count = (n: EventName) => events.filter((e) => e.name === n).length;

  return {
    totalSessions: engaged.length,
    funnel,
    medianTurnsToOptions: median(turnsToOptions),
    llmShare,
    slotsPerTurn,
    latency,
    dropOffs,
    paymentFailures: count('payment_failed'),
    paymentRetries: count('payment_retry'),
    reconciliations: count('reconciliation_run'),
    refunds: count('refund_initiated'),
    credentialBlocks: count('credential_blocked'),
    ungroundedBlocks: count('ungrounded_claim_blocked'),
  };
}

export type AnalyticsSummary = ReturnType<typeof summarize>;

export const analytics = new Analytics();
