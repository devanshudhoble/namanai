import React, { useState } from 'react';
import { Car, PlaneLanding, Clock3, Mountain, Users, ShieldCheck, Mic } from 'lucide-react';

interface CabsTabProps {
  onSend: (text: string) => void;
  isProcessing: boolean;
}

type Tab = 'airport' | 'rentals' | 'trips' | 'share';

const TABS: Record<Tab, { label: string; icon: React.ElementType; badge: string; blurb: string; prompts: { text: string; note: string }[] }> = {
  airport: {
    label: 'Airport',
    icon: PlaneLanding,
    badge: 'MVP',
    blurb: 'Linked to your Paytm flight. Fixed fare, tracks your real landing time, backup if the driver does not come.',
    prompts: [
      { text: '6E 2134 se aa rahi hoon, airport se ghar cab chahiye', note: 'Pickup · flight-linked · night' },
      { text: 'Kal subah 6 baje airport ke liye cab chahiye', note: 'Drop · leave-by time' },
    ],
  },
  rentals: {
    label: 'Rentals',
    icon: Clock3,
    badge: 'MVP',
    blurb: '4, 8 or 12 hours from verified local companies. One all-in price, compared side by side.',
    prompts: [
      { text: 'Kal 8 ghante ke liye gaadi chahiye, 95 km, 5 log', note: 'Compare 4 companies · AI all-in' },
      { text: 'Kal 4 ghante ke liye gaadi, women driver chahiye', note: 'Women-driver filter' },
    ],
  },
  trips: {
    label: 'Trips',
    icon: Mountain,
    badge: 'Next',
    blurb: 'Outstation round trips and one-way drops. The AI ranks every option against your budget, group and bags.',
    prompts: [
      { text: 'Bangalore se Coorg 3 din, 5 log, Amma bhi, 4 bags, budget 10000', note: 'AI recommender · why' },
      { text: 'Bangalore se Wayanad 2 din cab, 3 log', note: 'Kerala permit upfront' },
    ],
  },
  share: {
    label: 'Share',
    icon: Users,
    badge: 'Next',
    blurb: 'Seats in licensed cabs, cheaper empty-return legs, colleague carpool only where state rules allow.',
    prompts: [
      { text: 'Kal HSR se Whitefield office carpool, 1 seat', note: 'Bengaluru: rules engine' },
      { text: 'Kal Wakad se Hinjewadi carpool, 1 seat', note: 'Pune: fuel share allowed' },
    ],
  },
};

export const CabsTab: React.FC<CabsTabProps> = ({ onSend, isProcessing }) => {
  const [tab, setTab] = useState<Tab>('airport');
  const t = TABS[tab];
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <Car className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Paytm Cabs</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-200">New tab</span>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
          <ShieldCheck className="w-3.5 h-3.5" /> Paytm Assured: verified driver · all-in fare · backup or refund
        </span>
      </div>

      <div role="tablist" className="flex gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 w-full overflow-x-auto">
        {(Object.keys(TABS) as Tab[]).map((k) => {
          const Icon = TABS[k].icon;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex-1 min-w-[84px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === k ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {TABS[k].label}
              <span className={`text-[9px] px-1 rounded ${TABS[k].badge === 'MVP' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>{TABS[k].badge}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-slate-600 font-medium mb-2.5">{t.blurb}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {t.prompts.map((p) => (
          <button
            key={p.text}
            disabled={isProcessing}
            onClick={() => onSend(p.text)}
            className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-left transition cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-start gap-2">
              <Mic className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">“{p.text}”</p>
                <p className="text-[11px] text-slate-500 font-medium">{p.note}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
