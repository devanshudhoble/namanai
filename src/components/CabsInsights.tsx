import React, { useMemo, useState } from 'react';
import { Sparkles, PlaneLanding, Timer, TrendingDown, ShieldAlert, BarChart3, AlertTriangle, UserX } from 'lucide-react';
import type { BookingHold, TravelOption } from '../types';
import type { AgentContext } from '../services/voiceAgentOrchestrator';
import { BEST_DAY_TO_BOOK, OPERATOR_DEMAND, WEIGHTS, noShowRisk, operatorAdvice, to12h } from '../services/cabsEngine';

interface CabsInsightsProps {
  cab: NonNullable<AgentContext['cab']>;
  options: TravelOption[];
  hold: BookingHold | null;
  onSelect: (o: TravelOption) => void;
  onSend: (text: string) => void;
}

type Filter = 'all' | 'cheapest' | 'reliable' | 'fits' | 'women' | 'ev';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const CabsInsights: React.FC<CabsInsightsProps> = ({ cab, options, hold, onSelect, onSend }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const cabOptions = options.filter((o) => o.cab);
  const top = cabOptions[0];
  const shown = useMemo(() => {
    let list = [...cabOptions];
    if (filter === 'cheapest') list.sort((a, b) => a.price - b.price);
    if (filter === 'reliable') list.sort((a, b) => b.cab!.onTimePct - a.cab!.onTimePct);
    if (filter === 'fits') list = list.filter((o) => !o.cab!.why?.some((w) => w.startsWith('Too small')));
    if (filter === 'women') list = list.filter((o) => o.cab!.womenDriver);
    if (filter === 'ev') list = list.filter((o) => o.cab!.ev);
    return list;
  }, [cabOptions, filter]);
  const booked = hold?.selectedOption.cab && (hold.status === 'paid' || hold.status === 'reconciled') ? hold : null;
  const maxFare = Math.max(...BEST_DAY_TO_BOOK.map((d) => d.fare));
  const minFare = Math.min(...BEST_DAY_TO_BOOK.map((d) => d.fare));
  const maxFlyers = Math.max(...OPERATOR_DEMAND.map((d) => d.flyers));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-extrabold text-slate-900">Paytm Cabs · AI compare & insights</h3>
        </div>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Illustrative data</span>
      </div>

      {cab.flight && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs">
          <PlaneLanding className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-slate-900">
              {cab.flight.number} · {cab.flight.from} → {cab.flight.to} · {cab.flight.kind === 'arrival' ? 'lands' : 'departs'} {to12h(cab.flight.actualTime)}{' '}
              <span className={cab.flight.delayMin >= 15 ? 'text-orange-700' : 'text-emerald-700'}>({cab.flight.status})</span>
            </p>
            <p className="text-slate-600">
              {cab.flight.kind === 'arrival' ? 'Cab tracks your real landing time. Delays move the pickup at no charge.' : cab.leaveBy ? `Leave by ${to12h(cab.leaveBy)}, traffic included.` : ''}
            </p>
          </div>
        </div>
      )}
      {cab.blockedByCityRules && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <p><b>City rules engine:</b> {cab.blockedByCityRules}</p>
        </div>
      )}

      {cabOptions.length > 0 && !booked && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['all', 'AI ranking'], ['cheapest', 'Cheapest'], ['reliable', 'Most reliable'], ['fits', 'Fits group + bags'], ['women', 'Women driver'], ['ev', 'EV'],
            ] as [Filter, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 px-1 font-semibold">Provider</th>
                  <th className="py-1.5 px-1 font-semibold">Car</th>
                  <th className="py-1.5 px-1 font-semibold text-right">Base</th>
                  <th className="py-1.5 px-1 font-semibold text-right">AI all-in</th>
                  <th className="py-1.5 px-1 font-semibold text-right">On time</th>
                  <th className="py-1.5 px-1 font-semibold text-right">No-show risk</th>
                  <th className="py-1.5 px-1 font-semibold">Tag</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} onClick={() => onSelect(o)} className={`border-b border-slate-100 cursor-pointer hover:bg-blue-50/50 ${o === top ? 'bg-blue-50/40' : ''}`}>
                    <td className="py-1.5 px-1 font-bold text-slate-900">{o.operator}</td>
                    <td className="py-1.5 px-1 text-slate-700">{o.serviceNumber.split(' · ')[0]}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums text-slate-600">{inr(o.baseFare)}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums font-extrabold text-slate-900">{inr(o.price)}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums">{o.cab!.onTimePct}%</td>
                    <td className="py-1.5 px-1 text-right">{noShowRisk(o)}</td>
                    <td className="py-1.5 px-1 text-[11px] text-blue-700 font-bold">{o.recommendationTag}</td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={7} className="py-3 text-center text-slate-500">No option matches this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {top?.cab && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[11px] font-extrabold uppercase text-slate-500 mb-1.5">True cost, before you book</p>
                {top.cab.lines.map((l) => (
                  <div key={l.label} className="flex justify-between text-xs py-0.5"><span className="text-slate-600">{l.label}</span><span className="tabular-nums">{inr(l.amount)}</span></div>
                ))}
                <div className="flex justify-between text-xs pt-1 mt-1 border-t border-slate-200 font-extrabold"><span>All-in · {top.operator}</span><span className="tabular-nums">{inr(top.price)}</span></div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[11px] font-extrabold uppercase text-slate-500 mb-1.5">Why the AI picked it</p>
                <ul className="text-xs text-slate-700 space-y-0.5 list-disc pl-4">
                  {(top.cab.why ?? []).map((w) => <li key={w}>{w}</li>)}
                </ul>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Weights: price vs budget {WEIGHTS.price * 100}% · fit {WEIGHTS.fit * 100}% · reliability {WEIGHTS.reliability * 100}% · rating & safety {WEIGHTS.rating * 100}%. Fares come from quotes, never from the model.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {booked && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
          <p className="text-xs font-extrabold text-emerald-900">
            Ride booked · {booked.selectedOption.operator} · pickup {booked.selectedOption.departureTime} · {cab.driver ?? 'Driver details the day before'}
          </p>
          {booked.selectedOption.cab?.product === 'rental' && booked.selectedOption.cab.hours && (
            <div className="text-xs text-slate-700">
              <p className="font-bold">Live meter</p>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1"><div className="h-full bg-blue-600" style={{ width: '35%' }} /></div>
              <p className="text-[11px] text-slate-500 mt-0.5">2h 50m and 28 km used of {booked.selectedOption.cab.hours}h / {booked.selectedOption.cab.kmIncluded} km. Extra km billed in the app, never in cash.</p>
            </div>
          )}
          <p className="text-[11px] font-bold text-slate-600">Cab lab: say it, or tap</p>
          <div className="flex flex-wrap gap-2">
            {booked.selectedOption.cab?.flightNumber && (
              <button onClick={() => onSend('Meri flight 45 min late hai')} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-orange-300 text-orange-800 cursor-pointer flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> “Meri flight 45 min late hai”
              </button>
            )}
            <button onClick={() => onSend('Driver nahi aaya abhi tak')} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-rose-300 text-rose-800 cursor-pointer flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" /> “Driver nahi aaya abhi tak”
            </button>
          </div>
          {cab.backupProvider && <p className="text-[11px] text-emerald-800 font-bold">Backup assigned: {cab.backupProvider}, same fare.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> For you</p>
          <ul className="text-xs text-slate-700 mt-1 space-y-0.5">
            {cab.notes.map((n) => <li key={n}>• {n}</li>)}
          </ul>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Best day to book (Coorg Innova)</p>
          <div className="flex items-end gap-1 h-14 mt-2" aria-label="Fare by booking day">
            {BEST_DAY_TO_BOOK.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5">
                <div className={`w-full rounded-t ${d.fare === minFare || d.day === 'Wed' ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ height: `${30 + ((d.fare - minFare) / (maxFare - minFare)) * 70}%` }} title={`${d.day}: ${inr(d.fare)}`} />
                <span className="text-[9px] text-slate-500">{d.day}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-emerald-700 font-bold mt-1">Book Tue or Wed, save more</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> For operators</p>
          <div className="flex items-end gap-1 h-14 mt-2" aria-label="Paytm flyers landing at KIA by hour">
            {OPERATOR_DEMAND.map((d) => (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5">
                <div className={`w-full rounded-t ${d.flyers >= 300 ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${(d.flyers / maxFlyers) * 100}%` }} title={`${d.hour}: ${d.flyers} flyers`} />
                <span className="text-[9px] text-slate-500">{d.hour}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-blue-800 font-bold mt-1">{operatorAdvice()}</p>
        </div>
      </div>
    </div>
  );
};
