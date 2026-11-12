import React, { useEffect, useState } from 'react';
import { X, Activity, Zap, ShieldCheck, Layers, PieChart, CreditCard, Trash2 } from 'lucide-react';
import { analytics, type AnalyticsSummary } from '../services/analytics';
import { contextHarness } from '../services/contextHarness';

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LATENCY_LABEL: Record<string, string> = {
  nlu_ms: 'Understanding (LLM / rules)',
  tool_ms: 'Travel & payment tools',
  tts_ms: 'Voice synthesis (Sarvam, via backend)',
  turn_ms: 'Full turn (text in → reply)',
};

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

const Card: React.FC<{ title: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
        {icon}
        <span>{title}</span>
      </span>
      {right}
    </div>
    {children}
  </section>
);

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({ isOpen, onClose }) => {
  const [summary, setSummary] = useState<AnalyticsSummary>(() => analytics.summary());

  useEffect(() => {
    if (!isOpen) return;
    setSummary(analytics.summary());
    const unsub = analytics.subscribe(() => setSummary(analytics.summary()));
    return () => {
      unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const trace = contextHarness.getLastTrace();
  const ledger = contextHarness.getLedger();
  const top = summary.funnel[0]?.sessions || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border-l border-slate-200 h-full overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Journey Insights</h3>
              <p className="text-xs text-slate-500 font-medium">Measured from real events in this browser, not mock numbers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer" aria-label="Close insights">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Funnel */}
        <Card
          title="Booking funnel"
          icon={<PieChart className="w-3.5 h-3.5 text-emerald-600" />}
          right={<span className="text-[11px] font-mono text-slate-500">{summary.totalSessions} sessions</span>}
        >
          {top === 0 ? (
            <p className="text-xs text-slate-500">No conversations yet. Talk to the agent and this fills in live.</p>
          ) : (
            <div className="space-y-1.5">
              {summary.funnel.map((f, i) => {
                const prev = i === 0 ? f.sessions : summary.funnel[i - 1].sessions;
                const share = top ? f.sessions / top : 0;
                const stepConv = prev ? f.sessions / prev : 0;
                return (
                  <div key={f.stage}>
                    <div className="flex justify-between text-[11px] text-slate-700 font-medium">
                      <span>{f.label}</span>
                      <span className="font-mono">
                        {f.sessions} · {pct(share)}
                        {i > 0 && <span className={stepConv < 0.6 ? 'text-rose-600' : 'text-slate-400'}> ({pct(stepConv)} step)</span>}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(summary.dropOffs).length > 0 && (
            <p className="text-[11px] text-slate-600">
              <strong>Abandoned after:</strong>{' '}
              {Object.entries(summary.dropOffs)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k.replace(/_/g, ' ')} (${v})`)
                .join(', ')}
            </p>
          )}
        </Card>

        {/* Conversation quality */}
        <Card title="Conversation efficiency" icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <div className="text-lg font-black text-slate-900">{summary.medianTurnsToOptions ?? '—'}</div>
              <div className="text-[10px] text-slate-500 font-semibold">median turns to options</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <div className="text-lg font-black text-slate-900">{summary.slotsPerTurn === null ? '—' : summary.slotsPerTurn.toFixed(1)}</div>
              <div className="text-[10px] text-slate-500 font-semibold">trip details per turn</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <div className="text-lg font-black text-slate-900">{pct(summary.llmShare)}</div>
              <div className="text-[10px] text-slate-500 font-semibold">turns understood by LLM</div>
            </div>
          </div>
          <div className="space-y-1 text-[11px]">
            {summary.latency.map((l) => (
              <div key={l.metric} className="flex justify-between text-slate-700">
                <span>{LATENCY_LABEL[l.metric]}</span>
                <span className="font-mono">{l.samples ? `p50 ${l.median}ms · p90 ${l.p90}ms` : 'no samples'}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Payment & cancellation */}
        <Card title="Payment & cancellation patterns" icon={<CreditCard className="w-3.5 h-3.5 text-blue-600" />}>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
            <div className="bg-white rounded-lg border border-slate-200 p-2 flex justify-between"><span>UPI failures</span><b>{summary.paymentFailures}</b></div>
            <div className="bg-white rounded-lg border border-slate-200 p-2 flex justify-between"><span>Retries (same order)</span><b>{summary.paymentRetries}</b></div>
            <div className="bg-white rounded-lg border border-slate-200 p-2 flex justify-between"><span>Reconciliations</span><b>{summary.reconciliations}</b></div>
            <div className="bg-white rounded-lg border border-slate-200 p-2 flex justify-between"><span>Refunds started</span><b>{summary.refunds}</b></div>
          </div>
        </Card>

        {/* Context engineering */}
        <Card
          title="Context harness: last turn"
          icon={<Layers className="w-3.5 h-3.5 text-indigo-600" />}
          right={trace && <span className="text-[11px] font-mono text-slate-500">~{trace.approxTokens}/{trace.budgetTokens} tokens</span>}
        >
          {trace ? (
            <>
              <div className="space-y-1 text-[11px]">
                {trace.sections.map((s) => (
                  <div key={s.name} className={`flex justify-between ${s.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                    <span>{s.name}</span>
                    <span className="font-mono">{s.chars} chars</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Stage <b>{trace.stage}</b> · {trace.droppedDialogueTurns} old turns trimmed · {trace.redactions} numbers redacted before leaving the device
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">No turns yet.</p>
          )}
          <div className="text-[11px] font-mono bg-slate-900 text-slate-200 rounded-lg p-2 space-y-0.5 overflow-x-auto">
            {Object.keys(ledger).length === 0 && <div className="text-slate-500">slot ledger empty</div>}
            {Object.entries(ledger).map(([k, e]) => (
              <div key={k}>
                <span className="text-cyan-300">{k}</span>={String(e!.value)} <span className="text-slate-500">· {e!.source} · turn {e!.turn}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Guardrails */}
        <section className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Guardrails fired</span>
          </div>
          <p className="text-[11px] text-slate-700">
            PIN / OTP / card blocked: <b>{summary.credentialBlocks}</b> · Unverified ₹ or PNR claims blocked: <b>{summary.ungroundedBlocks}</b>
          </p>
        </section>

        <button
          onClick={() => analytics.clearAll()}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-600 py-2 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear analytics stored in this browser
        </button>
      </div>
    </div>
  );
};
