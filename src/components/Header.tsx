import React from 'react';
import { Sparkles, ShieldCheck, Zap, Activity, Sliders, BarChart3, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  latencyMs: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAnalytics,
  onOpenSettings,
  onReset,
  latencyMs,
}) => {
  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                VoyAI <span className="text-cyan-400 font-medium">Naman</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                Voice Travel Concierge
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous GDS Integration & Zero-Trust Payment Engine</p>
          </div>
        </div>

        {/* System Health / Badges */}
        <div className="hidden lg:flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Target Latency:</span>
            <span className="font-mono text-cyan-400 font-semibold">{latencyMs ? `${latencyMs}ms` : '<800ms'}</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Payment Guard:</span>
            <span className="font-semibold text-emerald-400">Out-of-Band UPI</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>GDS Grounding:</span>
            <span className="font-semibold text-cyan-400">0% Hallucination</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
            title="Reset Conversation & Inventory"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onOpenAnalytics}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-800/80 text-xs font-medium transition cursor-pointer shadow-sm shadow-cyan-900/20"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Pillar Analytics</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="API Integrations & Keys"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
