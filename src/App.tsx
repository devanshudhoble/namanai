import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { ConversationalFeed } from './components/ConversationalFeed';
import { TravelCanvas } from './components/TravelCanvas';
import { ScenarioPresets } from './components/ScenarioPresets';
import { AnalyticsDrawer } from './components/AnalyticsDrawer';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { VoiceAgentOrchestrator, AgentContext } from './services/voiceAgentOrchestrator';
import { speechService } from './services/speechService';
import { ApiKeysConfig, TravelOption } from './types';

export function App() {
  const [context, setContext] = useState<AgentContext | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [dialect, setDialect] = useState('en-IN');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
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
    if (context) {
      context.selectedOption = opt;
      setContext({ ...context });
      orchestratorRef.current?.handleSeatLockAndPaymentInitiation();
    }
  };

  const handleApprovePayment = () => {
    orchestratorRef.current?.completePaymentSuccess(true);
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
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <Header
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReset={handleReset}
        latencyMs={context.telemetry.totalLatencyMs}
      />

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Scenario Presets Bar */}
        <ScenarioPresets
          onTriggerScenario={handleTriggerScenario}
          isProcessing={context.step === 'processing' || context.step === 'discovering'}
        />

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Voice Visualizer & Conversational Dialogue Stream */}
          <div className="lg:col-span-5 space-y-5">
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

          {/* Right Column: Interactive Live Travel Canvas */}
          <div className="lg:col-span-7">
            <TravelCanvas
              options={context.options}
              selectedOption={context.selectedOption}
              hold={context.hold}
              transaction={context.transaction}
              step={context.step}
              onSelectOption={handleSelectOption}
              onApprovePayment={handleApprovePayment}
              onSimulateDeductionPending={handleSimulateDeductionPending}
              onSimulatePaymentDecline={handleSimulatePaymentDecline}
              onVoiceSupportQuery={handleSendMessage}
            />
          </div>
        </div>
      </main>

      {/* Analytics Drawer (Pillar 1) */}
      <AnalyticsDrawer
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        telemetry={context.telemetry}
      />

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
