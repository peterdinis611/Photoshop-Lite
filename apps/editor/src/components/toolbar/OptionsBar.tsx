import React from 'react';
import {
  FlipHorizontal,
  FlipVertical,
  AlignCenter,
  Bold,
  Italic,
  AlignLeft,
  AlignRight,
  Check,
  X,
  Sparkles,
  Move,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const OptionsBar: React.FC = () => {
  const {
    activeTool,
    activeShapeType,
    setActiveShapeType,
    brushSettings,
    updateBrushSettings,
    cropSettings,
    setCropSettings,
    applyCrop,
    cancelCrop,
    layers,
    selectedLayerId,
    updateLayer,
    canvasWidth,
    canvasHeight,
    zoom,
    setZoom,
    marqueeSelection,
    setMarqueeSelection,
    marqueeMode,
    setMarqueeMode,
    wandTolerance,
    setWandTolerance,
  } = useEditorStore();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const handleFlipH = () => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { scaleX: -selectedLayer.scaleX });
  };

  const handleFlipV = () => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { scaleY: -selectedLayer.scaleY });
  };

  const handleCenter = () => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      x: Math.round((canvasWidth - selectedLayer.width * Math.abs(selectedLayer.scaleX)) / 2),
      y: Math.round((canvasHeight - selectedLayer.height * Math.abs(selectedLayer.scaleY)) / 2),
    });
  };

  const toolLabel: Record<string, string> = {
    select: 'Move',
    marquee: 'Marquee',
    crop: 'Crop',
    brush: 'Brush',
    eraser: 'Eraser',
    refineBrush: 'Refine Edge',
    spotHealing: 'Spot Heal',
    clone: 'Clone Stamp',
    eyedropper: 'Eyedropper',
    text: 'Type',
    shape: 'Shape',
    hand: 'Hand',
    zoom: 'Zoom',
  };

  return (
    <div className="h-9 bg-[var(--bg-toolbar)] border-b border-[var(--border-subtle)] px-3 flex items-center gap-3 text-[11px] text-[var(--text-muted)] select-none overflow-x-auto">
      {/* Active tool badge */}
      <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-[var(--border-subtle)]">
        <Move size={12} className="text-[var(--accent)]" />
        <span className="font-display font-bold text-[var(--text-primary)] text-[11px]">
          {toolLabel[activeTool] || activeTool}
        </span>
      </div>

      {activeTool === 'select' && (
        <div className="flex items-center gap-2.5">
          {selectedLayer ? (
            <>
              <div className="flex items-center gap-2 font-mono-ui text-[10px] text-[var(--text-faint)]">
                <span>
                  X <b className="text-[var(--text-primary)] font-medium">{Math.round(selectedLayer.x)}</b>
                </span>
                <span>
                  Y <b className="text-[var(--text-primary)] font-medium">{Math.round(selectedLayer.y)}</b>
                </span>
                <span>
                  W{' '}
                  <b className="text-[var(--text-primary)] font-medium">
                    {Math.round(selectedLayer.width * Math.abs(selectedLayer.scaleX))}
                  </b>
                </span>
                <span>
                  H{' '}
                  <b className="text-[var(--text-primary)] font-medium">
                    {Math.round(selectedLayer.height * Math.abs(selectedLayer.scaleY))}
                  </b>
                </span>
                <span>
                  ∠ <b className="text-[var(--text-primary)] font-medium">{Math.round(selectedLayer.rotation)}°</b>
                </span>
              </div>
              <div className="h-3.5 w-px bg-[var(--border-subtle)]" />
              <div className="flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
                <button onClick={handleFlipH} title="Flip H" className="p-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <FlipHorizontal size={13} />
                </button>
                <button onClick={handleFlipV} title="Flip V" className="p-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <FlipVertical size={13} />
                </button>
                <button onClick={handleCenter} title="Center" className="p-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <AlignCenter size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-faint)]">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedLayer.opacity}
                  onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                  className="w-20 cursor-pointer"
                />
                <span className="font-mono-ui w-7 text-[var(--text-primary)]">
                  {Math.round(selectedLayer.opacity * 100)}%
                </span>
              </div>
            </>
          ) : (
            <span className="text-[var(--text-faint)] italic">No layer selected — click a layer or press V</span>
          )}
          {selectedLayer && (
            <span className="text-[var(--text-faint)] ml-1">
              · hold <kbd className="text-[var(--accent-hot)]">Shift</kbd> for proportional scale
            </span>
          )}
        </div>
      )}

      {activeTool === 'marquee' && (
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => setMarqueeMode('rect')}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                marqueeMode === 'rect'
                  ? 'bg-[var(--accent)] text-[#1a1208] font-semibold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Rect
            </button>
            <button
              onClick={() => setMarqueeMode('ellipse')}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                marqueeMode === 'ellipse'
                  ? 'bg-[var(--accent)] text-[#1a1208] font-semibold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Ellipse
            </button>
          </div>
          <span className="text-[var(--text-faint)]">
            Drag to select · <kbd className="text-[var(--accent-hot)]">Del</kbd> clears ·{' '}
            <kbd className="text-[var(--accent-hot)]">Esc</kbd> deselects
          </span>
          {marqueeSelection && (
            <button
              onClick={() => setMarqueeSelection(null)}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer text-[10px]"
            >
              Deselect
            </button>
          )}
        </div>
      )}

      {activeTool === 'lasso' && (
        <span className="text-[var(--text-faint)]">
          Drag freehand path · release to close · <kbd className="text-[var(--accent-hot)]">Del</kbd>{' '}
          clears inside path
        </span>
      )}

      {activeTool === 'wand' && (
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-faint)]">Click similar color region</span>
          <label className="flex items-center gap-1.5">
            <span>Tolerance</span>
            <input
              type="range"
              min={0}
              max={96}
              value={wandTolerance}
              onChange={(e) => setWandTolerance(Number(e.target.value))}
              className="w-24 cursor-pointer"
            />
            <span className="font-mono-ui text-[var(--text-primary)] w-6">{wandTolerance}</span>
          </label>
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span>Size</span>
            <input
              type="range"
              min="2"
              max="150"
              value={brushSettings.size}
              onChange={(e) => updateBrushSettings({ size: Number(e.target.value) })}
              className="w-24 cursor-pointer"
            />
            <span className="font-mono-ui w-8 text-[var(--text-primary)]">{brushSettings.size}</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Hardness</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={brushSettings.hardness}
              onChange={(e) => updateBrushSettings({ hardness: Number(e.target.value) })}
              className="w-20 cursor-pointer"
            />
            <span className="font-mono-ui w-8 text-[var(--text-primary)]">
              {Math.round(brushSettings.hardness * 100)}%
            </span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Opacity</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={brushSettings.opacity}
              onChange={(e) => updateBrushSettings({ opacity: Number(e.target.value) })}
              className="w-20 cursor-pointer"
            />
            <span className="font-mono-ui w-8 text-[var(--text-primary)]">
              {Math.round(brushSettings.opacity * 100)}%
            </span>
          </label>
          {activeTool === 'brush' && (
            <label className="flex items-center gap-1.5">
              <span>Color</span>
              <input
                type="color"
                value={brushSettings.color}
                onChange={(e) => updateBrushSettings({ color: e.target.value })}
                className="w-6 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
              />
            </label>
          )}
        </div>
      )}

      {activeTool === 'refineBrush' && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[var(--accent-hot)] font-semibold">
            <Sparkles size={12} /> Edge
          </span>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => updateBrushSettings({ refineMode: 'erase' })}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                brushSettings.refineMode === 'erase'
                  ? 'bg-[var(--danger)] text-white'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Erase
            </button>
            <button
              onClick={() => updateBrushSettings({ refineMode: 'restore' })}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                brushSettings.refineMode === 'restore'
                  ? 'bg-[var(--success)] text-[#0b0c0f]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Restore
            </button>
          </div>
          <label className="flex items-center gap-1.5">
            <span>Radius</span>
            <input
              type="range"
              min="4"
              max="80"
              value={brushSettings.size}
              onChange={(e) => updateBrushSettings({ size: Number(e.target.value) })}
              className="w-24 cursor-pointer"
            />
            <span className="font-mono-ui text-[var(--text-primary)]">{brushSettings.size}px</span>
          </label>
        </div>
      )}

      {activeTool === 'crop' && (
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-faint)]">Ratio</span>
          {(['free', '1:1', '16:9', '4:3', '9:16'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => {
                let w = cropSettings.width;
                let h = cropSettings.height;
                if (ratio === '1:1') {
                  const s = Math.min(w, h);
                  w = s;
                  h = s;
                } else if (ratio === '16:9') h = Math.round((w * 9) / 16);
                else if (ratio === '4:3') h = Math.round((w * 3) / 4);
                else if (ratio === '9:16') w = Math.round((h * 9) / 16);
                setCropSettings({ aspect: ratio, width: w, height: h });
              }}
              className={`px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium cursor-pointer border ${
                cropSettings.aspect === ratio
                  ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              {ratio === 'free' ? 'Free' : ratio}
            </button>
          ))}
          <div className="h-3.5 w-px bg-[var(--border-subtle)] mx-1" />
          <button
            onClick={applyCrop}
            className="flex items-center gap-1 px-2 py-0.5 bg-[var(--success)] text-[#0b0c0f] rounded-[var(--radius-sm)] font-semibold cursor-pointer"
          >
            <Check size={11} /> Apply
          </button>
          <button
            onClick={cancelCrop}
            className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] cursor-pointer"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      )}

      {(activeTool === 'text' || selectedLayer?.type === 'text') && (
        <div className="flex items-center gap-2.5">
          <select
            value={selectedLayer?.type === 'text' ? selectedLayer.fontFamily : 'Figtree'}
            onChange={(e) => {
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { fontFamily: e.target.value });
              }
            }}
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none cursor-pointer"
          >
            <option value="Figtree">Figtree</option>
            <option value="Syne">Syne</option>
            <option value="Georgia">Georgia</option>
            <option value="IBM Plex Mono">IBM Plex Mono</option>
            <option value="Impact">Impact</option>
          </select>
          <input
            type="number"
            min={8}
            max={200}
            value={selectedLayer?.type === 'text' ? selectedLayer.fontSize : 36}
            onChange={(e) => {
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) });
              }
            }}
            className="w-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-1 py-0.5 font-mono-ui text-[var(--text-primary)] outline-none"
          />
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => {
                if (selectedLayer?.type === 'text') {
                  const isBold = selectedLayer.fontStyle.includes('bold');
                  updateLayer(selectedLayer.id, { fontStyle: isBold ? 'normal' : 'bold' });
                }
              }}
              className={`p-1 rounded cursor-pointer ${
                selectedLayer?.type === 'text' && selectedLayer.fontStyle.includes('bold')
                  ? 'bg-[var(--accent)] text-[#1a1208]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Bold size={12} />
            </button>
            <button
              onClick={() => {
                if (selectedLayer?.type === 'text') {
                  const isItalic = selectedLayer.fontStyle.includes('italic');
                  updateLayer(selectedLayer.id, { fontStyle: isItalic ? 'normal' : 'italic' });
                }
              }}
              className={`p-1 rounded cursor-pointer ${
                selectedLayer?.type === 'text' && selectedLayer.fontStyle.includes('italic')
                  ? 'bg-[var(--accent)] text-[#1a1208]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Italic size={12} />
            </button>
          </div>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => {
                  if (selectedLayer?.type === 'text') updateLayer(selectedLayer.id, { align });
                }}
                className={`p-1 rounded cursor-pointer ${
                  selectedLayer?.type === 'text' && selectedLayer.align === align
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {align === 'left' ? <AlignLeft size={12} /> : align === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
              </button>
            ))}
          </div>
          <input
            type="color"
            value={selectedLayer?.type === 'text' ? selectedLayer.fill : '#ffffff'}
            onChange={(e) => {
              if (selectedLayer?.type === 'text') updateLayer(selectedLayer.id, { fill: e.target.value });
            }}
            className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
          />
          {selectedLayer?.type === 'text' && (
            <>
              <label className="flex items-center gap-1">
                <span className="text-[var(--text-faint)]">Track</span>
                <input
                  type="number"
                  min={-20}
                  max={40}
                  value={selectedLayer.letterSpacing}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { letterSpacing: Number(e.target.value) })
                  }
                  className="w-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1 py-0.5 font-mono-ui text-[var(--text-primary)]"
                />
              </label>
              <button
                onClick={() =>
                  updateLayer(selectedLayer.id, {
                    textDecoration:
                      selectedLayer.textDecoration === 'underline' ? 'none' : 'underline',
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                  selectedLayer.textDecoration === 'underline'
                    ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                U
              </button>
            </>
          )}
        </div>
      )}

      {activeTool === 'shape' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                'rectangle',
                'ellipse',
                'circle',
                'line',
                'arrow',
                'star',
                'polygon',
                'arc',
                'ring',
                'wedge',
                'callout',
              ] as const
            ).map((type) => (
              <button
                key={type}
                onClick={() => setActiveShapeType(type)}
                className={`px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] capitalize cursor-pointer border ${
                  activeShapeType === type
                    ? 'bg-[var(--accent)] text-[#1a1208] border-transparent font-semibold'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {selectedLayer?.type === 'shape' && (
            <>
              <div className="h-3.5 w-px bg-[var(--border-subtle)]" />
              <label className="flex items-center gap-1.5">
                <span>Fill</span>
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                  className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span>Stroke</span>
                <input
                  type="color"
                  value={selectedLayer.stroke}
                  onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                  className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                />
              </label>
              {(selectedLayer.shapeType === 'polygon' || selectedLayer.shapeType === 'star') && (
                <label className="flex items-center gap-1.5">
                  <span>{selectedLayer.shapeType === 'star' ? 'Points' : 'Sides'}</span>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    value={selectedLayer.sides || 5}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, { sides: Number(e.target.value) })
                    }
                    className="w-16 cursor-pointer"
                  />
                </label>
              )}
              {(selectedLayer.shapeType === 'arc' ||
                selectedLayer.shapeType === 'wedge' ||
                selectedLayer.shapeType === 'ring' ||
                selectedLayer.shapeType === 'star') && (
                <label className="flex items-center gap-1.5">
                  <span>{selectedLayer.shapeType === 'wedge' || selectedLayer.shapeType === 'arc' ? 'Angle' : 'Inner'}</span>
                  {selectedLayer.shapeType === 'wedge' || selectedLayer.shapeType === 'arc' ? (
                    <input
                      type="range"
                      min={15}
                      max={360}
                      value={selectedLayer.angle || 60}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, { angle: Number(e.target.value) })
                      }
                      className="w-16 cursor-pointer"
                    />
                  ) : (
                    <input
                      type="range"
                      min={0.15}
                      max={0.9}
                      step={0.05}
                      value={selectedLayer.innerRadius ?? 0.45}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, { innerRadius: Number(e.target.value) })
                      }
                      className="w-16 cursor-pointer"
                    />
                  )}
                </label>
              )}
            </>
          )}
        </div>
      )}

      {(activeTool === 'clone' || activeTool === 'spotHealing') && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span>Size</span>
            <input
              type="range"
              min="4"
              max="120"
              value={brushSettings.size}
              onChange={(e) => updateBrushSettings({ size: Number(e.target.value) })}
              className="w-24 cursor-pointer"
            />
            <span className="font-mono-ui text-[var(--text-primary)]">{brushSettings.size}px</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Hardness</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={brushSettings.hardness}
              onChange={(e) => updateBrushSettings({ hardness: Number(e.target.value) })}
              className="w-20 cursor-pointer"
            />
            <span className="font-mono-ui text-[var(--text-primary)]">
              {Math.round(brushSettings.hardness * 100)}%
            </span>
          </label>
          {activeTool === 'clone' && (
            <span className="text-[var(--text-faint)]">Alt+click to set source</span>
          )}
        </div>
      )}

      {activeTool === 'hand' && (
        <span className="text-[var(--text-faint)]">
          Drag to pan · hold <kbd className="font-mono-ui text-[var(--accent-hot)]">Space</kbd> anytime ·
          scroll to zoom
        </span>
      )}

      {activeTool === 'zoom' && (
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-faint)]">
            Click zoom in · <kbd className="font-mono-ui text-[var(--accent-hot)]">Alt</kbd>+click zoom out
          </span>
          <span className="font-mono-ui text-[var(--text-primary)]">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(8, z * 1.25))}
            className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-pointer"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}
            className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-pointer"
          >
            −
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-pointer text-[10px]"
          >
            100%
          </button>
        </div>
      )}

      {activeTool === 'eyedropper' && (
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-faint)]">Click canvas to sample</span>
          <div
            className="w-5 h-5 rounded border border-[var(--border-subtle)]"
            style={{ backgroundColor: brushSettings.color }}
          />
          <span className="font-mono-ui text-[var(--text-primary)] uppercase">{brushSettings.color}</span>
        </div>
      )}
    </div>
  );
};
