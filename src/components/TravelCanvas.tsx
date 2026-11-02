import React, { useState, useEffect } from 'react';
import {
  TravelOption,
  BookingHold,
  PaymentTransaction,
  AgentStateStep,
} from '../types';
import {
  Plane,
  Bus,
  Clock,
  Luggage,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowRight,
  Smartphone,
  AlertTriangle,
  QrCode,
  Calendar,
  Share2,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TravelCanvasProps {
  options: TravelOption[];
  selectedOption: TravelOption | null;
  hold: BookingHold | null;
  transaction: PaymentTransaction | null;
  step: AgentStateStep;
  onSelectOption: (opt: TravelOption) => void;
  onApprovePayment: () => void;
  onSimulateDeductionPending: () => void;
  onSimulatePaymentDecline: () => void;
  onVoiceSupportQuery: (text: string) => void;
}

export const TravelCanvas: React.FC<TravelCanvasProps> = ({
  options,
  selectedOption,
  hold,
  transaction,
  step,
  onSelectOption,
  onApprovePayment,
  onSimulateDeductionPending,
  onSimulatePaymentDecline,
  onVoiceSupportQuery,
}) => {
  // Hold countdown timer
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds

  useEffect(() => {
    if (!hold || hold.status !== 'held') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((hold.holdExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [hold]);

  useEffect(() => {
    if (step === 'confirmed') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#10b981'],
      });
    }
  }, [step]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isConfirmed = step === 'confirmed' || hold?.status === 'paid' || hold?.status === 'reconciled';
  const isPaymentPending = step === 'payment_pushed' || step === 'payment_verifying';
  const isExceptionRecovery = step === 'payment_exception_recovery';

  return (
    <div className="space-y-5">
      {/* 1. SEAT HOLD COUNTDOWN BANNER */}
      {hold && !isConfirmed && (
        <div className="glass-panel p-4 rounded-2xl border border-cyan-800/80 bg-gradient-to-r from-cyan-950/60 to-blue-950/40 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-900/60 border border-cyan-700 flex items-center justify-center text-cyan-300">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Seat & Fare Hold Guaranteed
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-900/80 text-[10px] font-mono text-cyan-300 border border-cyan-700">
                  {hold.orderId}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Seat 12F locked at ₹{hold.amount} for {hold.passenger.name}. No surge price risk.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Hold Expires In</span>
            <span className="text-lg font-mono font-bold text-amber-400">
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* 2. CONFIRMED DIGITAL BOARDING PASS (When Ticket is Issued) */}
      {isConfirmed && hold && (
        <div className="glass-panel rounded-3xl p-6 border-2 border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 shadow-2xl relative overflow-hidden">
          {/* Top Banner */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Confirmed Reservation
                </span>
                <h3 className="text-lg font-bold text-white">
                  {hold.selectedOption.provider} • {hold.selectedOption.serviceNumber}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 block">Airline PNR</span>
              <span className="text-xl font-mono font-extrabold text-cyan-400 tracking-wider">
                {hold.pnr}
              </span>
            </div>
          </div>

          {/* Route Details */}
          <div className="py-5 grid grid-cols-3 items-center text-center">
            <div className="text-left">
              <span className="text-2xl font-black text-white">{hold.selectedOption.originCode}</span>
              <p className="text-xs font-medium text-slate-300">{hold.selectedOption.origin}</p>
              <p className="text-xs text-cyan-400 font-semibold">{hold.selectedOption.departureTime}</p>
              <span className="text-[10px] text-slate-500">{hold.selectedOption.originTerminal}</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-400 font-mono mb-1">
                {hold.selectedOption.duration}
              </span>
              <div className="relative w-full flex items-center justify-center">
                <div className="h-[2px] w-full bg-slate-700"></div>
                <Plane className="w-4 h-4 text-cyan-400 absolute transform rotate-90" />
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 font-semibold">Non-stop</span>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-white">{hold.selectedOption.destCode}</span>
              <p className="text-xs font-medium text-slate-300">{hold.selectedOption.destination}</p>
              <p className="text-xs text-cyan-400 font-semibold">{hold.selectedOption.arrivalTime}</p>
              <span className="text-[10px] text-slate-500">{hold.selectedOption.destTerminal}</span>
            </div>
          </div>

          {/* Passenger & Baggage specs */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Passenger</span>
              <span className="font-semibold text-white">{hold.passenger.name}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Seat</span>
              <span className="font-semibold text-cyan-300">{hold.passenger.seatPreference || '12F'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Check-in Luggage</span>
              <span className="font-semibold text-emerald-400">15 kg Included</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Paid Total</span>
              <span className="font-semibold text-white">₹{hold.amount}</span>
            </div>
          </div>

          {/* Barcode & Post-booking actions */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
              <QrCode className="w-8 h-8 text-white p-1 bg-white rounded text-slate-900" />
              <div>
                <p className="text-white font-semibold">Ready for Digiyatra / Airport Entry</p>
                <p className="text-[10px] text-slate-400">Ticket sent to WhatsApp (+91 98450 12345)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onVoiceSupportQuery('Cancel my flight and calculate refund')}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-medium transition cursor-pointer"
              >
                Voice Assist: Cancel / Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. OUT-OF-BAND UPI PAYMENT PUSH SIMULATOR (Strategic Pillar 3) */}
      {isPaymentPending && transaction && (
        <div className="glass-panel rounded-2xl p-5 border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900 to-blue-950/40 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-cyan-400 animate-bounce" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Out-of-Band UPI Push Dispatched
              </h4>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 text-xs font-mono border border-cyan-800">
              Zero Voice Credentials
            </span>
          </div>

          <p className="text-xs text-slate-300">
            A secure payment collect request of{' '}
            <strong className="text-white">₹{transaction.amount}</strong> has been pushed to your UPI VPA{' '}
            <span className="text-cyan-400 font-mono font-semibold">{transaction.upiVpa}</span>.
          </p>

          {/* Interactive Simulated Push Notification Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                GPay
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Google Pay • UPI Collect Request</p>
                <p className="text-[11px] text-slate-400">VoyAI Travel Platform requests ₹{transaction.amount}</p>
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onApprovePayment}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                Approve Payment (UPI PIN)
              </button>

              <button
                onClick={onSimulateDeductionPending}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-amber-600/30"
                title="Simulates money deduction without instant PNR return (Scenario 5)"
              >
                Simulate "Deducted but Pending"
              </button>

              <button
                onClick={onSimulatePaymentDecline}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 3-WAY RECONCILIATION AUDIT LOG DISPLAY (When Scenario 5 is active) */}
      {isExceptionRecovery && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/60 text-xs text-amber-200 space-y-2 animate-pulse">
          <div className="flex items-center space-x-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Automated 3-Way Reconciliation In Progress...</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Checking Payment Gateway capture status, matching internal idempotency key, and forcing GDS reservation acknowledgment.
          </p>
        </div>
      )}

      {/* 5. TRAVEL COMPARISON OPTIONS (Pillar 2 & Primary Scenario) */}
      {options.length > 0 && !isConfirmed && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Verified Live Inventory</span>
              <span className="text-[11px] font-normal text-slate-400">
                (Grounding: GDS / NDC API)
              </span>
            </h3>
            <span className="text-xs text-cyan-400 font-mono">
              {options.length} options found
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {options.map((opt) => {
              const isSelected = selectedOption?.id === opt.id;
              const isFlight = opt.mode === 'flight';

              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectOption(opt)}
                  className={`p-4 rounded-2xl transition cursor-pointer border ${
                    isSelected
                      ? 'glass-card-active shadow-lg shadow-cyan-950/30'
                      : 'glass-card hover:border-slate-600'
                  }`}
                >
                  {/* Top tags */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isFlight ? 'bg-cyan-950 text-cyan-400' : 'bg-emerald-950 text-emerald-400'
                        }`}
                      >
                        {isFlight ? <Plane className="w-4 h-4" /> : <Bus className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{opt.provider}</h4>
                        <span className="text-[11px] font-mono text-slate-400">{opt.serviceNumber}</span>
                      </div>
                    </div>

                    {opt.recommendationTag && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-900/80 text-cyan-300 border border-cyan-700">
                        {opt.recommendationTag}
                      </span>
                    )}

                    {opt.isSpiked && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-900/80 text-rose-300 border border-rose-700 animate-pulse">
                        ⚠️ Airline Fare Surged
                      </span>
                    )}
                  </div>

                  {/* Schedule & Duration */}
                  <div className="flex items-center justify-between py-2 border-y border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-white text-sm">{opt.departureTime}</span>
                      <p className="text-[11px] text-slate-400">{opt.originCode} ({opt.originTerminal})</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{opt.duration}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-white text-sm">{opt.arrivalTime}</span>
                      <p className="text-[11px] text-slate-400">{opt.destCode} ({opt.destTerminal})</p>
                    </div>
                  </div>

                  {/* Features & Price */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="flex items-center space-x-1 text-slate-300">
                        <Luggage className="w-3 h-3 text-emerald-400" />
                        <span>{opt.baggage.checkIn}</span>
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-300">{opt.cancellation.refundSummary}</span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline space-x-1 justify-end">
                        {opt.originalPrice && (
                          <span className="text-xs text-slate-500 line-through">
                            ₹{opt.originalPrice}
                          </span>
                        )}
                        <span className="text-lg font-bold text-cyan-400">₹{opt.price}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">Total fare (Taxes incl.)</span>
                    </div>
                  </div>

                  {/* Trade-off summary banner */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                    <span>{opt.tradeOffDescription}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOption(opt);
                      }}
                      className="px-2.5 py-1 rounded-md bg-cyan-600/80 hover:bg-cyan-500 text-white font-medium text-xs transition cursor-pointer"
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
