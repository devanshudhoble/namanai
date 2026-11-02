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
      color: 'bg-blue-50/60 hover:bg-blue-50 border-blue-200 text-blue-700',
    },
    {
      id: 'sc-2',
      title: '2. Baggage & Policy Check',
      subtitle: 'Does ₹5,400 fare include check-in baggage?',
      prompt: 'Wait, does the ₹5,400 flight include check-in baggage? Because last time I booked a Saver fare, they charged me extra at the counter.',
      icon: Luggage,
      color: 'bg-indigo-50/60 hover:bg-indigo-50 border-indigo-200 text-indigo-700',
    },
    {
      id: 'sc-3',
      title: '3. Mid-Flow Modification',
      subtitle: 'Switch destination to Kochi',
      prompt: 'Actually wait! Don\'t book Goa. My friends just changed the plan to Kochi. Can we check Kochi instead?',
      icon: MapPin,
      color: 'bg-teal-50/60 hover:bg-teal-50 border-teal-200 text-teal-700',
    },
    {
      id: 'sc-4',
      title: '4. Dynamic Fare Spike Alert',
      subtitle: 'IndiGo surges to ₹8,600 • Akasa fallback',
      prompt: 'The fare spiked above my budget. What are my alternatives?',
      icon: TrendingUp,
      color: 'bg-rose-50/60 hover:bg-rose-50 border-rose-200 text-rose-700',
    },
    {
      id: 'sc-5',
      title: '5. Money Deducted, Ticket Pending',
      subtitle: 'Triggers automated 3-way reconciliation',
      prompt: 'My money has been deducted from Google Pay, but my ticket is not confirmed and shows pending!',
      icon: CreditCard,
      color: 'bg-amber-50/60 hover:bg-amber-50 border-amber-200 text-amber-800',
    },
    {
      id: 'sc-6',
      title: '6. Post-Booking Cancellation',
      subtitle: 'Calculate net refund under airline policy',
      prompt: 'I want to cancel my Goa flight booking. How much refund will I get?',
      icon: RefreshCw,
      color: 'bg-purple-50/60 hover:bg-purple-50 border-purple-200 text-purple-700',
    },
  ];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            1-Click Interactive Test Scenarios
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          Instant demo triggers for testing conversations
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
              className={`p-3 rounded-xl border text-left hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-2xs ${sc.color}`}
            >
              <div className="flex items-start space-x-2">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{sc.title}</h4>
                  <p className="text-[11px] text-slate-600 truncate font-medium">{sc.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
