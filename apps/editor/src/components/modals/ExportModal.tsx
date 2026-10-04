import React, { useState } from 'react';
import { X, Download, FileImage } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { downloadDataUrl, exportDocumentToDataUrl } from '../../utils/exportCanvas';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    canvasWidth,
    canvasHeight,
    backgroundColor,
  } = useEditorStore();

  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [scale, setScale] = useState<number>(1);
  const [transparentBg, setTransparentBg] = useState<boolean>(true);
  const [fileName, setFileName] = useState<string>('photoshop-lite-artwork');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isExportModalOpen) return null;

  const outWidth = Math.round(canvasWidth * scale);
  const outHeight = Math.round(canvasHeight * scale);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const dataUrl = await exportDocumentToDataUrl({
        format,
        quality,
        scale,
        transparentBackground: transparentBg,
        canvasWidth,
        canvasHeight,
        backgroundColor,
      });

      downloadDataUrl(dataUrl, `${fileName || 'artwork'}.${format}`);
      setExportModalOpen(false);
    } catch (e) {
      console.error('Export error:', e);
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#18191d] border border-[#2c2f38] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#2c2f38] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage size={18} className="text-blue-400" />
            <span className="font-semibold text-sm text-white">Export Artwork</span>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs text-zinc-300">
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-medium">File Name:</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="bg-[#1e2025] border border-[#2c2f38] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-medium">Format:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`py-2 rounded-lg border text-center font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    format === fmt
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-[#1e2025] border-[#2c2f38] text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {format !== 'png' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-zinc-400 font-medium">
                <span>Quality / Compression:</span>
                <span className="font-mono text-zinc-200">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="accent-blue-500 cursor-pointer"
              />
            </div>
          )}

          {format !== 'jpeg' && (
            <div className="flex items-center justify-between p-2.5 bg-[#1e2025] rounded-lg border border-[#2c2f38]">
              <span className="font-medium text-zinc-300">Transparent Background</span>
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-zinc-400 font-medium">
              <span>Resolution Scale:</span>
              <span className="font-mono text-zinc-200">
                {outWidth} × {outHeight} px
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                    scale === s
                      ? 'bg-blue-600/30 text-blue-400 border-blue-500 font-semibold'
                      : 'bg-[#1e2025] border-[#2c2f38] text-zinc-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-[11px] bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#2c2f38] bg-[#15161a] flex items-center justify-end gap-2.5">
          <button
            onClick={() => setExportModalOpen(false)}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-xs font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? 'Generating...' : `Download .${format.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
