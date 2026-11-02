import React from 'react';
import {
  Sparkles,
  Plane,
  Luggage,
  MapPin,
  TrendingUp,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface ScenarioPresetsProps {
  onTriggerScenario: (text: string) => void;
  isProcessing: boolean;
}

export const ScenarioPresets: React.FC<ScenarioPresetsProps> = ({
  onTriggerScenario,
  isProcessing,
}) => {
  const scenarios = [
    {
      id: 'sc-1',
      title: '1. Primary Booking Intent',
      subtitle: 'Bangalore to Goa • ₹8k budget • Convenience',
      prompt: 'Hi, I want to travel from Bangalore to Goa next Friday. My budget is around ₹8,000. I prefer a convenient journey and don\'t want to spend too much time comparing options.',
      icon: Plane,
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-800/80',
    },
    {
      id: 'sc-2',
      title: '2. Baggage & Policy Check',
      subtitle: 'Does ₹5,400 fare include check-in baggage?',
      prompt: 'Wait, does the ₹5,400 flight include check-in baggage? Because last time I booked a Saver fare, they charged me extra at the counter.',
      icon: Luggage,
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-800/80',
    },
    {
      id: 'sc-3',
      title: '3. Mid-Flow Modification',
      subtitle: 'Switch destination to Kochi',
      prompt: 'Actually wait! Don\'t book Goa. My friends just changed the plan to Kochi. Can we check Kochi instead?',
      icon: MapPin,
      color: 'from-teal-500/20 to-emerald-500/20 text-teal-400 border-teal-800/80',
    },
    {
      id: 'sc-4',
      title: '4. Dynamic Fare Spike Alert',
      subtitle: 'IndiGo surges to ₹8,600 • Akasa fallback',
      prompt: 'The fare spiked above my budget. What are my alternatives?',
      icon: TrendingUp,
      color: 'from-rose-500/20 to-amber-500/20 text-rose-400 border-rose-800/80',
    },
    {
      id: 'sc-5',
      title: '5. Money Deducted, Ticket Pending',
      subtitle: 'Triggers automated 3-way reconciliation',
      prompt: 'My money has been deducted from Google Pay, but my ticket is not confirmed and shows pending!',
      icon: CreditCard,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-800/80',
    },
    {
      id: 'sc-6',
      title: '6. Post-Booking Cancellation',
      subtitle: 'Calculate net refund under airline policy',
      prompt: 'I want to cancel my Goa flight booking. How much refund will I get?',
      icon: RefreshCw,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-800/80',
    },
  ];

  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-800 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            1-Click Executive Demo Scenarios
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Simulate realistic conversational edge-cases
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          return (
            <button
              key={sc.id}
              disabled={isProcessing}
              onClick={() => onTriggerScenario(sc.prompt)}
              className={`p-3 rounded-xl border text-left bg-gradient-to-br hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-50 ${sc.color}`}
            >
              <div className="flex items-start space-x-2">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-white truncate">{sc.title}</h4>
                  <p className="text-[11px] text-slate-300 truncate">{sc.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
