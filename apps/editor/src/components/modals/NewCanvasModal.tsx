import React, { useState } from 'react';
import { X, FilePlus, Sparkles, Layout } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

const PRESETS = [
  { name: 'Instagram Square', width: 1080, height: 1080, desc: '1:1 ratio' },
  { name: 'Instagram Story / Reel', width: 1080, height: 1920, desc: '9:16 vertical' },
  { name: 'YouTube Thumbnail', width: 1280, height: 720, desc: '16:9 HD' },
  { name: 'Full HD Landscape', width: 1920, height: 1080, desc: '1080p display' },
  { name: 'Portrait Photo', width: 1200, height: 1500, desc: '4:5 ratio' },
  { name: 'Banner / Header', width: 1500, height: 500, desc: '3:1 wide' },
];

export const NewCanvasModal: React.FC = () => {
  const {
    isNewCanvasModalOpen,
    setNewCanvasModalOpen,
    setCanvasDimensions,
    setBackgroundColor,
    backgroundColor,
  } = useEditorStore();

  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [bgChoice, setBgChoice] = useState<'transparent' | 'white' | 'black' | 'custom'>('transparent');
  const [customColor, setCustomColor] = useState('#1e2025');

  if (!isNewCanvasModalOpen) return null;

  const handleCreate = () => {
    const finalBg =
      bgChoice === 'transparent'
        ? 'transparent'
        : bgChoice === 'white'
        ? '#ffffff'
        : bgChoice === 'black'
        ? '#000000'
        : customColor;

    setCanvasDimensions(width, height);
    setBackgroundColor(finalBg);
    setNewCanvasModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#18191d] border border-[#2c2f38] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2c2f38] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilePlus size={18} className="text-blue-400" />
            <span className="font-semibold text-sm text-white">Create New Document</span>
          </div>
          <button
            onClick={() => setNewCanvasModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs text-zinc-300">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-medium">Standard Canvas Presets:</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const isSelected = width === p.width && height === p.height;
                return (
                  <button
                    key={p.name}
                    onClick={() => {
                      setWidth(p.width);
                      setHeight(p.height);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-[#1e2025] border-[#2c2f38] text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="font-semibold text-xs text-white">{p.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {p.width} × {p.height} px ({p.desc})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Width & Height */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2c2f38]">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Width (px):</label>
              <input
                type="number"
                min="50"
                max="8000"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="bg-[#1e2025] border border-[#2c2f38] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Height (px):</label>
              <input
                type="number"
                min="50"
                max="8000"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="bg-[#1e2025] border border-[#2c2f38] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2c2f38]">
            <label className="text-zinc-400 font-medium">Background Color:</label>
            <div className="grid grid-cols-4 gap-2">
              {(['transparent', 'white', 'black', 'custom'] as const).map((bg) => (
                <button
                  key={bg}
                  onClick={() => setBgChoice(bg)}
                  className={`py-2 rounded-lg border text-center font-medium capitalize transition-all cursor-pointer ${
                    bgChoice === bg
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#1e2025] border-[#2c2f38] text-zinc-400 hover:text-white'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2c2f38] bg-[#15161a] flex items-center justify-end gap-2.5">
          <button
            onClick={() => setNewCanvasModalOpen(false)}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-xs font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
          >
            <FilePlus size={14} />
            <span>Create Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
