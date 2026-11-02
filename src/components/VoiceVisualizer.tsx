import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, HandMetal, Sparkles } from 'lucide-react';

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
  // Simulated dynamic audio frequencies for waveform
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
          .map(() => Math.floor(Math.random() * (isSpeaking ? 38 : 28)) + 8)
      );
    }, 90);

    return () => clearInterval(interval);
  }, [isSpeaking, isListening]);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div
        className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
          isSpeaking
            ? 'bg-cyan-500/15 opacity-100'
            : isListening
            ? 'bg-emerald-500/15 opacity-100'
            : 'bg-indigo-500/5 opacity-40'
        }`}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Status Chip */}
        <div className="flex items-center space-x-2 mb-4">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              isSpeaking
                ? 'bg-cyan-400 animate-ping'
                : isListening
                ? 'bg-emerald-400 animate-ping'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
            {isSpeaking
              ? 'Agent Speaking (Neural TTS)'
              : isListening
              ? 'Listening to your voice...'
              : 'Voice Channel Ready'}
          </span>
        </div>

        {/* Central Glowing Mic / Voice Orb */}
        <div className="relative my-2 flex items-center justify-center">
          {/* Animated concentric pulse rings */}
          {(isSpeaking || isListening) && (
            <>
              <div
                className={`absolute w-32 h-32 rounded-full opacity-30 animate-ping pointer-events-none ${
                  isSpeaking ? 'bg-cyan-500' : 'bg-emerald-500'
                }`}
              />
              <div
                className={`absolute w-28 h-28 rounded-full border border-dashed opacity-40 animate-spin pointer-events-none ${
                  isSpeaking ? 'border-cyan-400' : 'border-emerald-400'
                }`}
                style={{ animationDuration: '8s' }}
              />
            </>
          )}

          <button
            onClick={onToggleMic}
            className={`relative z-20 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/40 scale-105 ring-4 ring-emerald-500/30'
                : isSpeaking
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/40 ring-4 ring-cyan-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-slate-900/50 hover:border-cyan-500/50'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice conversation'}
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

        {/* 24-Band Dynamic Audio Waveform Equalizer */}
        <div className="flex items-center justify-center gap-1.5 h-12 my-3 px-4 w-full max-w-md">
          {frequencies.map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                isSpeaking
                  ? 'bg-gradient-to-t from-cyan-600 to-cyan-300'
                  : isListening
                  ? 'bg-gradient-to-t from-emerald-600 to-teal-300'
                  : 'bg-slate-700'
              }`}
              style={{
                height: `${height}px`,
                opacity: isSpeaking || isListening ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Interim Voice Transcript Ticker */}
        <div className="w-full max-w-md min-h-[32px] px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-center mb-3">
          {interimTranscript ? (
            <p className="text-xs text-cyan-300 font-mono italic animate-pulse">
              "{interimTranscript}"
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              {isListening
                ? 'Say: "I want to travel from Bangalore to Goa next Friday, budget ₹8k..."'
                : 'Tap microphone or choose a 1-click scenario preset below'}
            </p>
          )}
        </div>

        {/* Interactive Voice Controls Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/60 w-full text-xs">
          {/* Barge-in / Interruption Button */}
          {isSpeaking && (
            <button
              onClick={onInterrupt}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition cursor-pointer font-medium animate-pulse"
              title="Interrupt agent speech immediately"
            >
              <HandMetal className="w-3.5 h-3.5" />
              <span>Barge-in / Interrupt</span>
            </button>
          )}

          {/* Dialect / Language Selector */}
          <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px] text-slate-400">Dialect:</span>
            <select
              value={dialect}
              onChange={(e) => onChangeDialect(e.target.value)}
              className="bg-transparent text-slate-200 text-[11px] font-medium focus:outline-none cursor-pointer"
            >
              <option value="en-IN" className="bg-slate-900 text-slate-200">
                Indian English (en-IN)
              </option>
              <option value="hinglish" className="bg-slate-900 text-slate-200">
                Hinglish / Colloquial
              </option>
              <option value="en-US" className="bg-slate-900 text-slate-200">
                Global English
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
