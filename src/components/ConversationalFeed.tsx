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
    <div className="glass-card rounded-2xl flex flex-col h-[520px] border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Real-time Dialogue Stream
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Zero-Hallucination Safe</span>
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-[11px] font-mono bg-slate-800/80 text-amber-300 px-3 py-1 rounded-full border border-amber-900/40">
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
                  <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Message Metadata & Action Buttons */}
                  <div className="flex items-center justify-between gap-3 mt-2 pt-1 border-t border-white/10 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>

                    {!isUser && (
                      <div className="flex items-center space-x-2">
                        {msg.latencyMs && (
                          <span className="font-mono text-cyan-400">
                            {msg.latencyMs}ms
                          </span>
                        )}
                        <button
                          onClick={() => handleReplayAudio(msg.text)}
                          className="hover:text-cyan-300 transition cursor-pointer flex items-center space-x-1"
                          title="Replay Voice Audio"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Replay</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tool Call Inspection Accordion */}
                  {msg.toolCall && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60">
                      <button
                        onClick={() => toggleTool(msg.id)}
                        className="flex items-center justify-between w-full text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-slate-900/80 px-2 py-1 rounded border border-cyan-900/60 transition cursor-pointer"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Code2 className="w-3 h-3" />
                          <span>⚡ {msg.toolCall.name}()</span>
                          <span className="text-slate-400">[{msg.toolCall.durationMs}ms]</span>
                        </div>
                        {expandedTools[msg.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedTools[msg.id] && (
                        <div className="mt-1.5 p-2 rounded bg-slate-950 font-mono text-[10px] text-slate-300 border border-slate-800 overflow-x-auto space-y-1">
                          <p className="text-emerald-400 flex items-center space-x-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Status: {msg.toolCall.resultSummary}</span>
                          </p>
                          <div className="text-slate-400">
                            Payload: {JSON.stringify(msg.toolCall.params)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-900/60 border border-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-blue-300" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 animate-pulse pl-9">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Agent orchestrating live travel API tools...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Manual Input Fallback */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Speak or type a question (e.g. 'Is check-in baggage included?')..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition cursor-pointer shadow-md shadow-cyan-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
