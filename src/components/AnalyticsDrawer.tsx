import React from 'react';
import {
  X,
  Activity,
  Zap,
  ShieldCheck,
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white border-l border-slate-200 h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Pillar 1: Journey & Voice Analytics
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Real-time latency waterfall and drop-off prediction
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. LATENCY WATERFALL BREAKDOWN */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Voice Latency Breakdown</span>
              </span>
              <span className="font-mono text-xs font-bold text-blue-600">
                Total: {telemetry.totalLatencyMs || 1020}ms
              </span>
            </div>

            {/* Waterfall bars */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 text-[11px] mb-1 font-medium">
                  <span>1. Streaming Voice STT</span>
                  <span className="font-mono font-bold text-slate-900">{telemetry.sttLatencyMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '28%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 text-[11px] mb-1 font-medium">
                  <span>2. Gemini LLM Reasoning & Function Calling</span>
                  <span className="font-mono font-bold text-slate-900">{telemetry.llmReasoningMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '34%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 text-[11px] mb-1 font-medium">
                  <span>3. Travel APIs (GDS & IRCTC)</span>
                  <span className="font-mono font-bold text-slate-900">{telemetry.apiToolLatencyMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-600 rounded-full" style={{ width: '18%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 text-[11px] mb-1 font-medium">
                  <span>4. Sarvam AI Neural Voice Synthesis (TTFB)</span>
                  <span className="font-mono font-bold text-slate-900">{telemetry.ttsTtfbMs}ms</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CONVERSION FUNNEL */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                <PieChart className="w-3.5 h-3.5 text-emerald-600" />
                <span>Search-to-Booking Funnel</span>
              </span>
              <span className="text-emerald-700 font-mono text-xs font-extrabold">+18% vs Mobile App</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-700 font-medium">1. Voice Intent Spoken</span>
                <span className="font-mono text-slate-900 font-bold">100%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-700 font-medium">2. Trade-off Options Presented</span>
                <span className="font-mono text-slate-900 font-bold">92%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-700 font-medium">3. 10-Min Seat & Fare Lock</span>
                <span className="font-mono text-slate-900 font-bold">78%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-300">
                <span className="text-emerald-800 font-bold">4. Confirmed PNR Ticketing</span>
                <span className="font-mono text-emerald-700 font-extrabold">64%</span>
              </div>
            </div>
          </div>

          {/* 3. PROSODY RADAR */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Acoustic Prosody & Hesitation Radar</span>
            </span>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              VoyAI evaluates cadence and speech silence. If a pause exceeds{' '}
              <strong className="text-amber-700">3.5 seconds</strong> following a price quote, the agent detects budget hesitation and dynamically surfaces payment terms or sleeper train alternatives.
            </p>
          </div>

          {/* 4. GROUNDING COMPLIANCE */}
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero-Hallucination Compliance</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              All live fares, seat counts, baggage tags, and cancellation terms are bound directly to JSON responses from the reservation engine. The LLM is strictly forbidden from guessing financial totals.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center font-medium">
          VoyAI Engine v1.0 • Built for Indian Travel Platforms
        </div>
      </div>
    </div>
  );
};
