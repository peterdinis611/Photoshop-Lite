import React, { useEffect, useState } from 'react';
import { X, Download, FileImage } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { downloadDataUrl, exportDocumentToDataUrl } from '../../utils/exportCanvas';
import {
  isAvifEncodeSupported,
  listExportFormats,
  type ExportImageFormat,
} from '../../utils/imageFormats';

interface ExportPreset {
  id: string;
  label: string;
  hint: string;
  format: ExportImageFormat;
  quality?: number;
  /** Fixed scale, or derive from the document so the long edge hits a target. */
  scale: number | ((w: number, h: number) => number);
  transparent?: boolean;
  fileName: string;
}

const clampScale = (s: number) => Math.min(4, Math.max(0.1, Math.round(s * 100) / 100));

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'web',
    label: 'Web',
    hint: 'PNG · 1× · transparent',
    format: 'png',
    scale: 1,
    transparent: true,
    fileName: 'photoshop-lite-web',
  },
  {
    id: 'story',
    label: 'Instagram Story',
    hint: 'JPEG 90% · long edge → 1920 px',
    format: 'jpeg',
    quality: 0.9,
    scale: (w, h) => clampScale(1920 / Math.max(w, h, 1)),
    fileName: 'photoshop-lite-story',
  },
  {
    id: 'print',
    label: 'Print-ish',
    hint: 'PNG · 2×',
    format: 'png',
    scale: 2,
    fileName: 'photoshop-lite-print',
  },
  {
    id: 'email',
    label: 'Email',
    hint: 'JPEG 75% · 0.5×',
    format: 'jpeg',
    quality: 0.75,
    scale: 0.5,
    fileName: 'photoshop-lite-email',
  },
];

const chipBase =
  'rounded-[var(--radius-sm)] border text-center font-semibold transition-colors cursor-pointer';
const chipOn =
  'bg-[var(--accent)] text-[#1a1208] border-[var(--accent-hot)] shadow-[0_0_14px_var(--accent-dim)]';
const chipOff =
  'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    canvasWidth,
    canvasHeight,
    backgroundColor,
  } = useEditorStore();

  const [format, setFormat] = useState<ExportImageFormat>('png');
  const [formats, setFormats] = useState<ExportImageFormat[]>(['png', 'jpeg', 'webp']);
  const [quality, setQuality] = useState<number>(0.92);
  const [scale, setScale] = useState<number>(1);
  const [transparentBg, setTransparentBg] = useState<boolean>(true);
  const [fileName, setFileName] = useState<string>('photoshop-lite-artwork');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExportModalOpen) return;
    void isAvifEncodeSupported().then((ok) => setFormats(listExportFormats(ok)));
  }, [isExportModalOpen]);

  if (!isExportModalOpen) return null;

  const outWidth = Math.round(canvasWidth * scale);
  const outHeight = Math.round(canvasHeight * scale);

  const applyPreset = (preset: ExportPreset) => {
    setActivePreset(preset.id);
    setFormat(preset.format);
    if (preset.quality !== undefined) setQuality(preset.quality);
    setScale(
      typeof preset.scale === 'function'
        ? preset.scale(canvasWidth, canvasHeight)
        : preset.scale
    );
    if (preset.transparent !== undefined) setTransparentBg(preset.transparent);
    setFileName(preset.fileName);
  };

  /** Manual tweaks leave preset mode so the chip highlight stays honest. */
  const manual = <T,>(setter: (v: T) => void) => (v: T) => {
    setActivePreset(null);
    setter(v);
  };

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
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage size={18} className="text-[var(--accent-hot)]" />
            <span className="font-display font-semibold text-sm text-[var(--text-primary)]">
              Export Artwork
            </span>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            aria-label="Close export dialog"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs text-[var(--text-muted)] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[var(--text-muted)] font-medium">Presets:</span>
              <span className="font-mono-ui text-[10px] text-[var(--text-faint)]">
                one click · tweak below
              </span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Export presets">
              {EXPORT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={preset.hint}
                  aria-pressed={activePreset === preset.id}
                  className={`${chipBase} px-3 py-1.5 ${
                    activePreset === preset.id ? chipOn : chipOff
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="min-h-[1rem] font-mono-ui text-[10px] text-[var(--text-faint)]">
              {EXPORT_PRESETS.find((p) => p.id === activePreset)?.hint ??
                'Web · Story · Print-ish · Email'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)] font-medium">File Name:</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => manual(setFileName)(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)] font-medium">Format:</label>
            <div className={`grid gap-2 ${formats.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {formats.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => manual(setFormat)(fmt)}
                  className={`${chipBase} py-2 uppercase tracking-wider ${
                    format === fmt ? chipOn : chipOff
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {format !== 'png' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[var(--text-muted)] font-medium">
                <span>Quality / Compression:</span>
                <span className="font-mono-ui text-[var(--text-primary)]">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={(e) => manual(setQuality)(Number(e.target.value))}
                className="accent-[var(--accent)] cursor-pointer"
              />
            </div>
          )}

          {format !== 'jpeg' && (
            <div className="flex items-center justify-between p-2.5 bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
              <span className="font-medium text-[var(--text-primary)]">Transparent Background</span>
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => manual(setTransparentBg)(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent)] rounded cursor-pointer"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[var(--text-muted)] font-medium">
              <span>Resolution Scale:</span>
              <span className="font-mono-ui text-[var(--text-primary)]">
                {outWidth} × {outHeight} px
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => manual(setScale)(s)}
                  className={`${chipBase} py-1.5 ${scale === s ? chipOn : chipOff}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            {![0.5, 1, 2].includes(scale) && (
              <p className="font-mono-ui text-[10px] text-[var(--accent-hot)]">
                Custom scale {scale}× (from preset)
              </p>
            )}
          </div>

          {error && (
            <p className="text-[var(--danger)] text-[11px] bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-[var(--radius-sm)] px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-toolbar)] flex items-center justify-end gap-2.5">
          <button
            onClick={() => setExportModalOpen(false)}
            className="px-4 py-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center gap-1.5 px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hot)] text-[#1a1208] font-semibold text-xs shadow-lg shadow-[var(--accent-glow)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? 'Generating...' : `Download .${format.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
