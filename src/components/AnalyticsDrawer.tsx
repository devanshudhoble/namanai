import React from 'react';
import {
  X,
  Activity,
  Zap,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  Clock,
  PieChart,
} from 'lucide-react';
import { TelemetryMetrics } from '../types';

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryMetrics;
}

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  isOpen,
  onClose,
  telemetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Pillar 1: Journey & AI Analytics
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time telemetry, latency waterfall, and drop-off prediction
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. LATENCY WATERFALL BREAKDOWN */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Conversational Latency Waterfall</span>
              </span>
              <span className="font-mono text-xs font-bold text-cyan-400">
                Total: {telemetry.totalLatencyMs || 1020}ms
              </span>
            </div>

            {/* Waterfall bars */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>1. Streaming STT (Deepgram Nova-2)</span>
                  <span className="font-mono text-white">{telemetry.sttLatencyMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '28%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>2. LLM Intent & Function Calling</span>
                  <span className="font-mono text-white">{telemetry.llmReasoningMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '34%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>3. GDS / NDC Airline API</span>
                  <span className="font-mono text-white">{telemetry.apiToolLatencyMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '18%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>4. Neural TTS Time-To-First-Byte</span>
                  <span className="font-mono text-white">{telemetry.ttsTtfbMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-400 rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CONVERSION FUNNEL & DROP-OFF OPTIMIZATION */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
                <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                <span>Booking Funnel Conversion</span>
              </span>
              <span className="text-emerald-400 font-mono text-xs font-bold">+18% vs Web</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                <span className="text-slate-300">1. Spoken Intent Received</span>
                <span className="font-mono text-white font-semibold">100%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                <span className="text-slate-300">2. Trade-off Options Presented</span>
                <span className="font-mono text-white font-semibold">92%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                <span className="text-slate-300">3. Seat & Fare Hold Locked</span>
                <span className="font-mono text-white font-semibold">78%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-800">
                <span className="text-emerald-300 font-semibold">4. Confirmed PNR Ticketing</span>
                <span className="font-mono text-emerald-400 font-bold">64%</span>
              </div>
            </div>
          </div>

          {/* 3. PROSODY & HESITATION ANALYSIS */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Acoustic Prosody & Hesitation Radar</span>
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              VoyAI evaluates cadence and speech silence. If a pause exceeds{' '}
              <strong className="text-amber-400">3.5 seconds</strong> following a price quote, the agent detects budget hesitation and dynamically surfaces payment terms or budget-friendly sleeper alternatives.
            </p>
          </div>

          {/* 4. GROUNDING & HALLUCINATION COMPLIANCE */}
          <div className="glass-card p-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Hallucination Compliance</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              All live fares, seat counts, baggage tags, and cancellation terms are bound directly to JSON responses from the deterministic reservation engine. LLMs are strictly forbidden from generating financial totals.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          VoyAI Engine v1.0 • GDS API Sandbox Mode Active
        </div>
      </div>
    </div>
  );
};
