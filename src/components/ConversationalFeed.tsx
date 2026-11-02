import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { Volume2, Bot, User, Code2, ChevronDown, ChevronUp, Send, CheckCircle2 } from 'lucide-react';
import { speechService } from '../services/speechService';

interface ConversationalFeedProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

export const ConversationalFeed: React.FC<ConversationalFeedProps> = ({
  messages,
  onSendMessage,
  isProcessing,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleReplayAudio = (text: string) => {
    speechService.speak(text);
  };

  return (
    <div className="bg-white rounded-2xl flex flex-col h-[520px] border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Live Travel Conversation
          </span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Verified Real-Time Fares</span>
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-[11px] font-medium bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200 shadow-xs">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="flex items-start space-x-2 max-w-[88%]">
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{msg.text}</p>

                  {/* Message Action / Replay Bar */}
                  <div
                    className={`flex items-center justify-between gap-3 mt-2 pt-1 border-t text-[10px] ${
                      isUser ? 'border-white/20 text-blue-100' : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>

                    {!isUser && (
                      <div className="flex items-center space-x-2">
                        {msg.latencyMs && (
                          <span className="font-mono text-blue-600 font-semibold">
                            {msg.latencyMs}ms
                          </span>
                        )}
                        <button
                          onClick={() => handleReplayAudio(msg.text)}
                          className="hover:text-blue-600 text-slate-500 font-semibold transition cursor-pointer flex items-center space-x-1"
                          title="Play Voice Audio"
                        >
                          <Volume2 className="w-3 h-3 text-blue-600" />
                          <span>Listen</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tool Call Inspection Accordion */}
                  {msg.toolCall && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => toggleTool(msg.id)}
                        className="flex items-center justify-between w-full text-[11px] font-mono text-blue-700 hover:text-blue-800 bg-blue-50/80 px-2 py-1 rounded border border-blue-200 transition cursor-pointer"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Code2 className="w-3 h-3" />
                          <span>⚡ {msg.toolCall.name}()</span>
                          <span className="text-slate-500">[{msg.toolCall.durationMs}ms]</span>
                        </div>
                        {expandedTools[msg.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedTools[msg.id] && (
                        <div className="mt-1.5 p-2 rounded bg-slate-900 font-mono text-[10px] text-slate-200 border border-slate-800 overflow-x-auto space-y-1">
                          <p className="text-emerald-400 flex items-center space-x-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Result: {msg.toolCall.resultSummary}</span>
                          </p>
                          <div className="text-slate-400">
                            Params: {JSON.stringify(msg.toolCall.params)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-blue-700" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-blue-600 font-semibold animate-pulse pl-9">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Checking live flight, train, and bus availability...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips (inspired by Indian Superapp in Pic 4) */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] scrollbar-none">
        <span className="text-slate-400 font-bold shrink-0 text-[10px] uppercase">Suggestions:</span>
        <button
          type="button"
          onClick={() => onSendMessage('Goa')}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer shrink-0 font-medium shadow-2xs"
        >
          🏖️ Goa jana hai
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('Goa next Friday, budget around 8000')}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer shrink-0 font-medium shadow-2xs"
        >
          ✈️ Next Friday, budget ₹8k
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('Show me train options')}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer shrink-0 font-medium shadow-2xs"
        >
          🚆 Train options
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('Does the flight include check-in baggage?')}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer shrink-0 font-medium shadow-2xs"
        >
          🧳 Baggage allowance?
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('My money has been deducted from Google Pay but ticket pending')}
          className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer shrink-0 font-bold shadow-2xs"
        >
          💳 Money deducted, ticket pending
        </button>
      </div>

      {/* Manual Input Fallback */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-200 bg-white flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Speak or type (e.g. 'Goa', 'Next Friday', 'Flights under ₹6,000')..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition cursor-pointer shadow-sm shadow-blue-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
