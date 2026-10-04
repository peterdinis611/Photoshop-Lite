import React, { useState } from 'react';
import { X, Key, Check, ExternalLink } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    removeBgApiKey,
    replicateApiKey,
    setApiKeys,
  } = useEditorStore();

  const [remKey, setRemKey] = useState(removeBgApiKey);
  const [repKey, setRepKey] = useState(replicateApiKey);
  const [saved, setSaved] = useState(false);

  if (!isSettingsModalOpen) return null;

  const handleSave = () => {
    setApiKeys({
      removeBgApiKey: remKey.trim(),
      replicateApiKey: repKey.trim(),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSettingsModalOpen(false);
    }, 800);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2c2f38] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-blue-400" />
            <span className="font-semibold text-sm text-white">AI Engine & API Settings</span>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs text-zinc-300">
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            Photoshop-Lite works 100% locally in-browser via WebAssembly by default. You can optionally connect cloud AI services below for heavy batch tasks or dedicated models:
          </p>

          {/* remove.bg */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-zinc-300 font-medium">remove.bg API Key:</label>
              <a
                href="https://www.remove.bg/api"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
              >
                Get Key <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              placeholder="e.g. abc123def456..."
              value={remKey}
              onChange={(e) => setRemKey(e.target.value)}
              className="bg-[#1e2025] border border-[#2c2f38] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          {/* Replicate Real-ESRGAN */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-zinc-300 font-medium">Replicate API Token (Real-ESRGAN):</label>
              <a
                href="https://replicate.com/account/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
              >
                Get Token <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              placeholder="e.g. r8_..."
              value={repKey}
              onChange={(e) => setRepKey(e.target.value)}
              className="bg-[#1e2025] border border-[#2c2f38] rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 font-mono text-xs"
            />
          </div>

          <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-500 leading-tight">
            *Keys are stored only in your local browser storage.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2c2f38] bg-[#15161a] flex items-center justify-end gap-2.5">
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-xs font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
          >
            {saved ? <Check size={14} /> : null}
            <span>{saved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
