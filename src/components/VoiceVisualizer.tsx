import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, HandMetal, Sparkles } from 'lucide-react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  onToggleMic: () => void;
  onInterrupt: () => void;
  dialect: string;
  onChangeDialect: (d: string) => void;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  isSpeaking,
  interimTranscript,
  onToggleMic,
  onInterrupt,
  dialect,
  onChangeDialect,
}) => {
  const [frequencies, setFrequencies] = useState<number[]>(Array(24).fill(8));

  useEffect(() => {
    if (!isSpeaking && !isListening) {
      setFrequencies(Array(24).fill(6));
      return;
    }

    const interval = setInterval(() => {
      setFrequencies(
        Array(24)
          .fill(0)
          .map(() => Math.floor(Math.random() * (isSpeaking ? 36 : 26)) + 8)
      );
    }, 90);

    return () => clearInterval(interval);
  }, [isSpeaking, isListening]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Background soft ambient blue tint */}
      <div
        className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
          isSpeaking
            ? 'bg-blue-100 opacity-80'
            : isListening
            ? 'bg-emerald-100 opacity-80'
            : 'bg-slate-50 opacity-40'
        }`}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Status Indicator */}
        <div className="flex items-center space-x-2 mb-3">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              isSpeaking
                ? 'bg-blue-600 animate-ping'
                : isListening
                ? 'bg-emerald-500 animate-ping'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-xs font-bold tracking-wide uppercase text-slate-600">
            {isSpeaking
              ? 'Speaking (Sarvam Neural Voice)'
              : isListening
              ? 'Listening to your voice...'
              : 'Voice Assistant Ready'}
          </span>
        </div>

        {/* Central Glowing Mic Orb */}
        <div className="relative my-2 flex items-center justify-center">
          {(isSpeaking || isListening) && (
            <>
              <div
                className={`absolute w-32 h-32 rounded-full opacity-25 animate-ping pointer-events-none ${
                  isSpeaking ? 'bg-blue-600' : 'bg-emerald-500'
                }`}
              />
              <div
                className={`absolute w-28 h-28 rounded-full border border-dashed opacity-40 animate-spin pointer-events-none ${
                  isSpeaking ? 'border-blue-500' : 'border-emerald-500'
                }`}
                style={{ animationDuration: '8s' }}
              />
            </>
          )}

          <button
            onClick={onToggleMic}
            className={`relative z-20 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-emerald-500/30 scale-105 ring-4 ring-emerald-100'
                : isSpeaking
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/30 ring-4 ring-blue-100'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25 ring-4 ring-blue-50'
            }`}
            title={isListening ? 'Stop listening' : 'Start speaking with assistant'}
          >
            {isListening ? (
              <Mic className="w-8 h-8 animate-pulse" />
            ) : isSpeaking ? (
              <Volume2 className="w-8 h-8 animate-bounce" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* 24-Band Audio Waveform Equalizer */}
        <div className="flex items-center justify-center gap-1.5 h-10 my-3 px-4 w-full max-w-md">
          {frequencies.map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                isSpeaking
                  ? 'bg-gradient-to-t from-blue-600 to-cyan-500'
                  : isListening
                  ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                  : 'bg-slate-200'
              }`}
              style={{
                height: `${height}px`,
                opacity: isSpeaking || isListening ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Interim Voice Transcript Ticker */}
        <div className="w-full max-w-md min-h-[36px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center mb-3">
          {interimTranscript ? (
            <p className="text-xs text-blue-700 font-semibold italic animate-pulse">
              "{interimTranscript}"
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 font-medium">
              {isListening
                ? 'Listening... Tell me where you want to travel.'
                : '💡 Speak naturally: mention any city (e.g. Nagpur, Delhi, Manali), date, or ask a question'}
            </p>
          )}
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 w-full text-xs">
          {/* Barge-in / Interrupt Button */}
          {isSpeaking ? (
            <button
              onClick={onInterrupt}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer font-bold animate-pulse"
              title="Interrupt assistant speech"
            >
              <HandMetal className="w-3.5 h-3.5 text-rose-600" />
              <span>Tap to Interrupt</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Natural hands-free voice</span>
          )}

          {/* Dialect / Language Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] text-slate-600 font-medium">Language:</span>
            <select
              value={dialect}
              onChange={(e) => onChangeDialect(e.target.value)}
              className="bg-transparent text-slate-800 text-[11px] font-bold focus:outline-none cursor-pointer"
            >
              <option value="en-IN">Indian English (en-IN)</option>
              <option value="hinglish">Hinglish / Hindi</option>
              <option value="en-US">Global English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
