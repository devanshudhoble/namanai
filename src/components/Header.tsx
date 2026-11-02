import React from 'react';
import { Sparkles, ShieldCheck, Zap, Sliders, BarChart3, RotateCcw, Headphones, Compass } from 'lucide-react';

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
}) => {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 py-3 sm:px-6 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-500 shadow-md shadow-blue-500/20">
            <Compass className="w-5 h-5 text-white animate-spin-slow" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-['Plus_Jakarta_Sans']">
                VoyAI <span className="text-blue-600">Naman</span>
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Voice Travel Concierge
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Flights • Trains • Buses • Instant UPI Booking
            </p>
          </div>
        </div>

        {/* Clean, Consumer-Friendly Indian Travel Trust Badges (No Developer Jargon) */}
        <div className="hidden md:flex items-center space-x-2.5 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
            <span className="text-sm">🇮🇳</span>
            <span>All-India Travel</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Safe UPI Payment</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-semibold">
            <Headphones className="w-3.5 h-3.5 text-blue-600" />
            <span>Speak in Hindi or English</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
            title="Start New Travel Search"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Search</span>
          </button>

          <button
            onClick={onOpenAnalytics}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Pillar Analytics</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
            title="API Integrations & Keys"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
