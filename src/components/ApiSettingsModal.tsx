import React, { useState } from 'react';
import { X, Key, Save, CheckCircle2, Shield } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Key className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">API Connectors & Settings</h3>
              <p className="text-xs text-slate-500 font-medium">Configure Sarvam Voice, Gemini LLM, and Travel APIs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Environment */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block">Execution Mode</span>
              <span className="text-[11px] text-slate-500 font-medium">
                Sarvam AI Neural Voice & Gemini 2.5 Flash are active
              </span>
            </div>
            <select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
              className="bg-white text-slate-800 border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="sandbox">Sandbox Simulator</option>
              <option value="live">Live Enterprise Connectors</option>
            </select>
          </div>

          {/* Gemini API Key */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Google Gemini API Key (Intent Reasoning)
            </label>
            <input
              type="password"
              value={formData.geminiKey || ''}
              onChange={(e) => setFormData({ ...formData, geminiKey: e.target.value })}
              placeholder="Configured in backend .env"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Sarvam AI Key */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Sarvam AI Voice Key (Bulbul Neural Indian Voice)
            </label>
            <input
              type="password"
              value={formData.elevenlabsKey || ''}
              onChange={(e) => setFormData({ ...formData, elevenlabsKey: e.target.value })}
              placeholder="Configured in backend .env"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start space-x-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <span className="font-medium">
              Keys are strictly stored in local environment files (.env) and automatically ignored by Git.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm shadow-blue-600/30"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
