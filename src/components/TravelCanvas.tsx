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
  Train,
  Hotel,
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
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'flight' | 'train' | 'bus' | 'hotel'>('all');

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
        colors: ['#0284c7', '#2563eb', '#10b981'],
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
    <div className="space-y-4">
      {/* 1. SEAT HOLD COUNTDOWN BANNER */}
      {hold && !isConfirmed && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                  Seat & Price Locked (10-Min Guarantee)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[10px] font-mono font-bold text-blue-800 border border-blue-200">
                  {hold.orderId}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Seat 12F guaranteed at ₹{hold.amount} for {hold.passenger.name}. No surge price risk.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">Time Left</span>
            <span className="text-lg font-mono font-extrabold text-blue-700">
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* 2. CONFIRMED DIGITAL BOARDING PASS (When Ticket is Issued) */}
      {isConfirmed && hold && (
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/60 shadow-md relative overflow-hidden">
          {/* Top Banner */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Confirmed Reservation
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {hold.selectedOption.provider} • {hold.selectedOption.serviceNumber}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">PNR Number</span>
              <span className="text-xl font-mono font-black text-blue-600 tracking-wider">
                {hold.pnr}
              </span>
            </div>
          </div>

          {/* Route Details */}
          <div className="py-5 grid grid-cols-3 items-center text-center">
            <div className="text-left">
              <span className="text-2xl font-black text-slate-900">{hold.selectedOption.originCode}</span>
              <p className="text-xs font-bold text-slate-700">{hold.selectedOption.origin}</p>
              <p className="text-xs text-blue-600 font-bold">{hold.selectedOption.departureTime}</p>
              <span className="text-[10px] text-slate-500">{hold.selectedOption.originTerminal}</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-500 font-semibold mb-1">
                {hold.selectedOption.duration}
              </span>
              <div className="relative w-full flex items-center justify-center">
                <div className="h-[2px] w-full bg-slate-200"></div>
                <Plane className="w-4 h-4 text-blue-600 absolute transform rotate-90" />
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold mt-1">
                Direct
              </span>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-slate-900">{hold.selectedOption.destCode}</span>
              <p className="text-xs font-bold text-slate-700">{hold.selectedOption.destination}</p>
              <p className="text-xs text-blue-600 font-bold">{hold.selectedOption.arrivalTime}</p>
              <span className="text-[10px] text-slate-500">{hold.selectedOption.destTerminal}</span>
            </div>
          </div>

          {/* Passenger & Baggage specs */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold">Passenger</span>
              <span className="font-extrabold text-slate-900">{hold.passenger.name}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold">Seat / Berth</span>
              <span className="font-extrabold text-blue-700">{hold.passenger.seatPreference || '12F'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold">Check-in Baggage</span>
              <span className="font-extrabold text-emerald-700">15 kg Included</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold">Total Fare</span>
              <span className="font-extrabold text-slate-900">₹{hold.amount}</span>
            </div>
          </div>

          {/* Barcode & Post-booking actions */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-slate-600 text-xs">
              <QrCode className="w-9 h-9 text-slate-900 p-1 bg-white border border-slate-200 rounded-lg shadow-xs" />
              <div>
                <p className="text-slate-900 font-bold text-xs">Digiyatra & Boarding Ready</p>
                <p className="text-[11px] text-slate-500 font-medium">Sent to WhatsApp (+91 98450 12345)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onVoiceSupportQuery('Cancel my flight and calculate refund')}
                className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
              >
                Cancel or Modify via Voice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. OUT-OF-BAND UPI PAYMENT PUSH SIMULATOR */}
      {isPaymentPending && transaction && (
        <div className="bg-white rounded-2xl p-5 border-2 border-blue-500 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-blue-600 animate-bounce" />
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Instant UPI Payment Request Sent
              </h4>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              100% Safe • Zero Card Voice
            </span>
          </div>

          <p className="text-xs text-slate-600 font-medium">
            A payment request of <strong className="text-slate-900 font-bold">₹{transaction.amount}</strong> was
            sent directly to your UPI ID:{' '}
            <span className="text-blue-700 font-mono font-bold">{transaction.upiVpa}</span>.
          </p>

          {/* Interactive Google Pay Simulator Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs">
                GPay
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Google Pay • UPI Collect Request</p>
                <p className="text-[11px] text-slate-500 font-medium">VoyAI Travel Platform requests ₹{transaction.amount}</p>
              </div>
            </div>

            {/* Test Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onApprovePayment}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Approve Payment (UPI PIN)
              </button>

              <button
                onClick={onSimulateDeductionPending}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                title="Test when bank deducts money but booking takes time"
              >
                Simulate "Deducted but Pending"
              </button>

              <button
                onClick={onSimulatePaymentDecline}
                className="px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 3-WAY RECONCILIATION AUDIT */}
      {isExceptionRecovery && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2 animate-pulse">
          <div className="flex items-center space-x-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Automated 3-Way Bank Reconciliation In Progress...</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Checking Payment Gateway capture status, matching internal idempotency key, and confirming ticket with the reservation desk.
          </p>
        </div>
      )}

      {/* 5. MULTI-MODAL TRAVEL OPTIONS: FLIGHT, TRAIN, BUS, HOTEL */}
      {options.length > 0 && !isConfirmed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>Verified Travel Options</span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Live Pricing & Seats
              </span>
            </h3>

            {/* Travel Mode Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({options.length})
              </button>
              <button
                onClick={() => setSelectedCategory('flight')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  selectedCategory === 'flight'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✈️ Flights
              </button>
              <button
                onClick={() => setSelectedCategory('train')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  selectedCategory === 'train'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚆 Trains
              </button>
              <button
                onClick={() => setSelectedCategory('bus')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  selectedCategory === 'bus'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚌 Buses
              </button>
              <button
                onClick={() => setSelectedCategory('hotel')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  selectedCategory === 'hotel'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏨 Hotels
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {options
              .filter((opt) => (selectedCategory === 'all' ? true : opt.mode === selectedCategory))
              .map((opt) => {
                const isSelected = selectedOption?.id === opt.id;
                const isFlight = opt.mode === 'flight';
                const isTrain = opt.mode === 'train';
                const isHotel = opt.mode === 'hotel';

                return (
                  <div
                    key={opt.id}
                    onClick={() => onSelectOption(opt)}
                    className={`p-4 rounded-2xl transition cursor-pointer border ${
                      isSelected
                        ? 'glass-card-active'
                        : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
                    }`}
                  >
                    {/* Top tags */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                            isFlight
                              ? 'bg-blue-100 text-blue-700'
                              : isTrain
                              ? 'bg-amber-100 text-amber-800'
                              : isHotel
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isFlight ? (
                            <Plane className="w-4 h-4" />
                          ) : isTrain ? (
                            <Train className="w-4 h-4" />
                          ) : isHotel ? (
                            <Hotel className="w-4 h-4" />
                          ) : (
                            <Bus className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h4 className="text-sm font-extrabold text-slate-900">{opt.provider}</h4>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {opt.mode}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 font-medium">
                            {opt.serviceNumber}
                          </span>
                        </div>
                      </div>

                      {opt.recommendationTag && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                          {opt.recommendationTag}
                        </span>
                      )}

                      {opt.isSpiked && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          ⚠️ Airline Fare Surged
                        </span>
                      )}
                    </div>

                  {/* Schedule & Duration */}
                  <div className="flex items-center justify-between py-2.5 border-y border-slate-100 text-xs">
                    <div>
                      <span className="font-extrabold text-slate-900 text-sm">{opt.departureTime}</span>
                      <p className="text-[11px] text-slate-500 font-medium">{opt.originCode} ({opt.originTerminal})</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-slate-500 font-semibold flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>{opt.duration}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 text-sm">{opt.arrivalTime}</span>
                      <p className="text-[11px] text-slate-500 font-medium">{opt.destCode} ({opt.destTerminal})</p>
                    </div>
                  </div>

                  {/* Features & Price */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="flex items-center space-x-1 text-slate-600 font-medium">
                        <Luggage className="w-3 h-3 text-emerald-600" />
                        <span>{opt.baggage.checkIn}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-medium">{opt.cancellation.refundSummary}</span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline space-x-1 justify-end">
                        {opt.originalPrice && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{opt.originalPrice}
                          </span>
                        )}
                        <span className="text-xl font-black text-blue-700">₹{opt.price}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Total fare (Taxes incl.)</span>
                    </div>
                  </div>

                  {/* Trade-off summary banner */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium flex items-center justify-between">
                    <span>{opt.tradeOffDescription}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOption(opt);
                      }}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
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
