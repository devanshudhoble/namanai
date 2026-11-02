import React, { useState } from 'react';
import { X, Key, Save, CheckCircle2, Shield, Info } from 'lucide-react';
import { ApiKeysConfig } from '../types';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiKeysConfig;
  onSaveConfig: (cfg: ApiKeysConfig) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<ApiKeysConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">API Integrations & Keys</h3>
              <p className="text-xs text-slate-400">Configure live LLM, Voice, and GDS Travel connectors</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Mode Switcher */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Execution Environment</span>
              <span className="text-[11px] text-slate-400">
                Sandbox includes realistic GDS fares, payment pushes, and neural voice
              </span>
            </div>
            <select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
              className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="sandbox">Sandbox Simulator</option>
              <option value="live">Live Enterprise APIs</option>
            </select>
          </div>

          {/* Gemini API Key */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Google Gemini / OpenAI API Key (LLM Orchestration)
            </label>
            <input
              type="password"
              value={formData.geminiKey || ''}
              onChange={(e) => setFormData({ ...formData, geminiKey: e.target.value })}
              placeholder="AIzaSy... or sk-..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Leave blank to use the high-fidelity built-in deterministic reasoning engine.
            </p>
          </div>

          {/* Deepgram / ElevenLabs Voice Key */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              ElevenLabs / Deepgram Voice Key (Optional)
            </label>
            <input
              type="password"
              value={formData.elevenlabsKey || ''}
              onChange={(e) => setFormData({ ...formData, elevenlabsKey: e.target.value })}
              placeholder="xi-..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Default uses high-definition Web Speech Neural Indian English synthesis.
            </p>
          </div>

          {/* Amadeus / GDS Key */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Amadeus / Sabre GDS API Key (Travel Inventory)
            </label>
            <input
              type="password"
              value={formData.amadeusKey || ''}
              onChange={(e) => setFormData({ ...formData, amadeusKey: e.target.value })}
              placeholder="Live GDS Client ID / Secret"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800 text-[11px] text-cyan-300 flex items-start space-x-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
            <span>
              All keys are stored securely in browser session storage and never transmitted to untrusted endpoints.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow-md shadow-cyan-600/30"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
