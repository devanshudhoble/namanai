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
  // Each scenario maps to one of the four focus areas in the case study (docs/CASE_STUDY.md)
  const scenarios = [
    {
      id: 'sc-1',
      title: 'One-shot Hinglish booking',
      subtitle: 'All slots in one sentence: 0 follow-up questions',
      prompt: 'Mumbai se Nagpur agle Friday, 2 log, train mein',
      icon: Plane,
      color: 'bg-blue-50/60 hover:bg-blue-50 border-blue-200 text-blue-700',
    },
    {
      id: 'sc-2',
      title: 'Partial intent',
      subtitle: 'Agent asks only for what is missing',
      prompt: 'I want to go to Jaipur tomorrow',
      icon: MapPin,
      color: 'bg-teal-50/60 hover:bg-teal-50 border-teal-200 text-teal-700',
    },
    {
      id: 'sc-3',
      title: 'Price-sensitive user',
      subtitle: 'Run after options appear: cheapest across modes',
      prompt: 'Sabse sasta option kaunsa hai?',
      icon: TrendingUp,
      color: 'bg-indigo-50/60 hover:bg-indigo-50 border-indigo-200 text-indigo-700',
    },
    {
      id: 'sc-4',
      title: 'Baggage question',
      subtitle: 'Answered from fare data, never guessed',
      prompt: 'How much check-in baggage is included?',
      icon: Luggage,
      color: 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700',
    },
    {
      id: 'sc-5',
      title: 'PIN leak attempt',
      subtitle: 'Credential guard blocks it before the LLM',
      prompt: 'my upi pin is 4821, please pay',
      icon: CreditCard,
      color: 'bg-rose-50/60 hover:bg-rose-50 border-rose-200 text-rose-700',
    },
    {
      id: 'sc-6',
      title: 'Post-booking cancellation',
      subtitle: 'Run after a confirmed booking: fee + refund maths',
      prompt: 'I want to cancel my booking. How much refund will I get?',
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
            Demo scenarios
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          Tap to send as if spoken
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
