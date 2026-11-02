import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { ConversationalFeed } from './components/ConversationalFeed';
import { TravelCanvas } from './components/TravelCanvas';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { VoiceAgentOrchestrator, AgentContext } from './services/voiceAgentOrchestrator';
import { speechService } from './services/speechService';
import { ApiKeysConfig, TravelOption } from './types';
import { Home, Ticket, Mic, CreditCard, User, Sparkles, Plane, Train, Bus, Hotel } from 'lucide-react';

export function App() {
  const [context, setContext] = useState<AgentContext | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [dialect, setDialect] = useState('en-IN');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiKeysConfig>({ mode: 'sandbox' });

  const orchestratorRef = useRef<VoiceAgentOrchestrator | null>(null);

  // Initialize Orchestrator on mount
  useEffect(() => {
    const orch = new VoiceAgentOrchestrator((newCtx) => {
      setContext({ ...newCtx });
    });
    orchestratorRef.current = orch;
    setContext(orch.getContext());

    // Check speech synthesis polling for visualizer
    const speechPoll = setInterval(() => {
      setIsSpeaking(speechService.isSpeaking());
    }, 100);

    return () => {
      clearInterval(speechPoll);
      speechService.stopSpeaking();
      speechService.stopListening();
    };
  }, []);

  // Toggle Microphone
  const handleToggleMic = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      // If agent is speaking, interrupt it (Barge-in)
      if (isSpeaking) {
        orchestratorRef.current?.interruptSpeech();
        setIsSpeaking(false);
      }

      setIsListening(true);
      speechService.startListening(
        (transcript: string, isFinal: boolean) => {
          if (isFinal) {
            setInterimTranscript('');
            setIsListening(false);
            speechService.stopListening();
            orchestratorRef.current?.handleUserUtterance(transcript, true);
          } else {
            setInterimTranscript(transcript);
          }
        },
        (error: string) => {
          console.warn('Speech recognition warning:', error);
          setIsListening(false);
          setInterimTranscript('');
        },
        () => {
          setIsListening(false);
        }
      );
    }
  };

  const handleInterrupt = () => {
    orchestratorRef.current?.interruptSpeech();
    setIsSpeaking(false);
  };

  const handleSendMessage = (text: string) => {
    orchestratorRef.current?.handleUserUtterance(text, true);
  };

  const handleTriggerScenario = (promptText: string) => {
    orchestratorRef.current?.handleUserUtterance(promptText, true);
  };

  const handleSelectOption = (opt: TravelOption) => {
    orchestratorRef.current?.handleSelectOptionExplicitly(opt);
  };

  const handleApprovePayment = () => {
    orchestratorRef.current?.handleSimulatedPaymentApproval();
  };

  const handleSimulateDeductionPending = () => {
    orchestratorRef.current?.handlePaymentDeductedException();
  };

  const handleSimulatePaymentDecline = () => {
    orchestratorRef.current?.handleUserUtterance('My payment failed on Google Pay', true);
  };

  const handleReset = () => {
    orchestratorRef.current?.reset();
    setIsListening(false);
    setIsSpeaking(false);
    setInterimTranscript('');
  };

  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] text-slate-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-['Plus_Jakarta_Sans'] pb-20">
      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReset={handleReset}
        latencyMs={context.telemetry.totalLatencyMs}
      />

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Flagship Travel AI Hero Card (inspired by Indian superapps in Pic 4) */}
        <div className="bg-gradient-to-r from-[#002970] via-[#003B95] to-[#00BAF2] rounded-3xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-extrabold uppercase tracking-wide backdrop-blur-xs">
                Travel AI Concierge
              </span>
              <span className="text-cyan-200 text-xs font-semibold">
                🇮🇳 Hindi & Indian English Voice
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Aapka Travel AI Concierge — Bol ke book karo
            </h2>
            <p className="text-xs text-blue-100 font-medium max-w-xl">
              Flight, Train (IRCTC), Bus ya Hotel — bas natural voice mein boliye, real-time availability check karke instant UPI se secure booking karein.
            </p>
          </div>

          {/* Quick Travel Mode Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleSendMessage('I want to book a flight')}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs text-white"
            >
              <Plane className="w-3.5 h-3.5 text-cyan-200" />
              <span>Flights</span>
            </button>
            <button
              onClick={() => handleSendMessage('I want to travel by train')}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs text-white"
            >
              <Train className="w-3.5 h-3.5 text-amber-200" />
              <span>Trains</span>
            </button>
            <button
              onClick={() => handleSendMessage('Show me sleeper bus options')}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs text-white"
            >
              <Bus className="w-3.5 h-3.5 text-emerald-200" />
              <span>Buses</span>
            </button>
            <button
              onClick={() => handleSendMessage('I need a hotel booking')}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs text-white"
            >
              <Hotel className="w-3.5 h-3.5 text-purple-200" />
              <span>Hotels</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Voice Assistant & Dialogue Stream */}
          <div className="lg:col-span-5 space-y-4">
            <VoiceVisualizer
              isListening={isListening}
              isSpeaking={isSpeaking}
              interimTranscript={interimTranscript}
              onToggleMic={handleToggleMic}
              onInterrupt={handleInterrupt}
              dialect={dialect}
              onChangeDialect={setDialect}
            />

            <ConversationalFeed
              messages={context.messages}
              onSendMessage={handleSendMessage}
              isProcessing={context.step === 'processing' || context.step === 'discovering'}
            />
          </div>

          {/* Right Column: Interactive Multi-Modal Travel Canvas */}
          <div className="lg:col-span-7">
            <TravelCanvas
              options={context.options}
              selectedOption={context.selectedOption}
              hold={context.hold}
              transaction={context.transaction}
              step={context.step}
              origin={context.origin}
              destination={context.destination}
              date={context.date}
              passengersCount={context.passengersCount}
              onSelectOption={handleSelectOption}
              onApprovePayment={handleApprovePayment}
              onSimulateDeductionPending={handleSimulateDeductionPending}
              onSimulatePaymentDecline={handleSimulatePaymentDecline}
              onVoiceSupportQuery={handleSendMessage}
            />
          </div>
        </div>
      </main>

      {/* Flagship Bottom Superapp Navigation Bar (as in Pic 4) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-6 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => handleReset()}
            className="flex flex-col items-center space-y-1 text-slate-500 hover:text-blue-700 transition cursor-pointer"
          >
            <Home className="w-5 h-5 text-blue-700" />
            <span className="text-[10px] font-bold text-blue-700">Home</span>
          </button>

          <button
            onClick={() => handleSendMessage('What is my booking status?')}
            className="flex flex-col items-center space-y-1 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <Ticket className="w-5 h-5" />
            <span className="text-[10px] font-medium">My Trips</span>
          </button>

          {/* Center Glowing Voice Action Button */}
          <div className="relative -top-4">
            <button
              onClick={handleToggleMic}
              className={`w-13 h-13 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 transform active:scale-95 cursor-pointer ring-4 ${
                isListening
                  ? 'bg-emerald-500 ring-emerald-100 animate-pulse'
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-500 ring-blue-100 hover:scale-105'
              }`}
              title="Tap to speak"
            >
              <Mic className="w-6 h-6" />
            </button>
          </div>

          <button
            onClick={() => handleSendMessage('My money has been deducted from Google Pay but ticket pending')}
            className="flex flex-col items-center space-y-1 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] font-medium">UPI & Reco</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center space-y-1 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Account</span>
          </button>
        </div>
      </nav>

      {/* API Integrations Settings Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSaveConfig={setApiConfig}
      />
    </div>
  );
}

export default App;
