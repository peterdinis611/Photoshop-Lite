import React from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const StylesPanel: React.FC = () => {
  const { layers, selectedLayerId, updateLayer, canvasWidth, canvasHeight } = useEditorStore();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  if (!selectedLayer) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center text-[var(--text-faint)] text-xs h-full gap-2 select-none">
        <Layers size={28} className="text-[var(--border-strong)]" />
        <p className="font-medium text-[var(--text-muted)]">No layer selected</p>
        <p className="text-[11px] max-w-[200px]">
          Select a layer to edit transform, stroke, shadow, and glow.
        </p>
      </div>
    );
  }

  const styles = selectedLayer.styles || {};

  const updateStyle = (key: string, value: unknown) => {
    updateLayer(selectedLayer.id, {
      styles: {
        ...styles,
        [key]: value,
      },
    });
  };

  const field =
    'flex items-center gap-1.5 bg-[var(--bg-elevated)] px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]';

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-xs text-[var(--text-muted)] gap-4 select-none animate-panel-in">
      <div className="flex flex-col gap-2.5">
        <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
          Transform
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className={field}>
            <span className="text-[var(--text-faint)] font-mono-ui text-[11px]">X</span>
            <input
              type="number"
              value={Math.round(selectedLayer.x)}
              onChange={(e) => updateLayer(selectedLayer.id, { x: Number(e.target.value) })}
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
          <div className={field}>
            <span className="text-[var(--text-faint)] font-mono-ui text-[11px]">Y</span>
            <input
              type="number"
              value={Math.round(selectedLayer.y)}
              onChange={(e) => updateLayer(selectedLayer.id, { y: Number(e.target.value) })}
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
          <div className={field}>
            <span className="text-[var(--text-faint)] font-mono-ui text-[11px]">W</span>
            <input
              type="number"
              value={Math.round(selectedLayer.width * Math.abs(selectedLayer.scaleX))}
              onChange={(e) =>
                updateLayer(selectedLayer.id, {
                  scaleX:
                    (Number(e.target.value) / selectedLayer.width) *
                    Math.sign(selectedLayer.scaleX || 1),
                })
              }
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
          <div className={field}>
            <span className="text-[var(--text-faint)] font-mono-ui text-[11px]">H</span>
            <input
              type="number"
              value={Math.round(selectedLayer.height * Math.abs(selectedLayer.scaleY))}
              onChange={(e) =>
                updateLayer(selectedLayer.id, {
                  scaleY:
                    (Number(e.target.value) / selectedLayer.height) *
                    Math.sign(selectedLayer.scaleY || 1),
                })
              }
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
          <div className={`${field} col-span-2`}>
            <span className="text-[var(--text-faint)] font-mono-ui text-[11px]">∠</span>
            <input
              type="range"
              min="0"
              max="360"
              value={Math.round(selectedLayer.rotation) % 360}
              onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
              className="flex-1 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] w-9 text-right text-[var(--text-muted)]">
              {Math.round(selectedLayer.rotation) % 360}°
            </span>
          </div>
        </div>
        <button
          onClick={() =>
            updateLayer(selectedLayer.id, {
              x: Math.round(
                (canvasWidth - selectedLayer.width * Math.abs(selectedLayer.scaleX)) / 2
              ),
              y: Math.round(
                (canvasHeight - selectedLayer.height * Math.abs(selectedLayer.scaleY)) / 2
              ),
            })
          }
          className="text-[10px] text-[var(--accent-hot)] hover:underline cursor-pointer self-start"
        >
          Center on canvas
        </button>
      </div>

      {selectedLayer.type === 'shape' && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
            Shape fill
          </span>
          <div className="flex items-center justify-between">
            <span>Fill</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedLayer.fill}
                onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                className="w-6 h-6 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
              />
              <span className="font-mono-ui text-[11px]">{selectedLayer.fill}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Stroke</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedLayer.stroke}
                onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                className="w-6 h-6 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
              />
              <input
                type="number"
                min={0}
                max={40}
                value={selectedLayer.strokeWidth}
                onChange={(e) =>
                  updateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) })
                }
                className="w-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1 py-0.5 font-mono-ui text-[var(--text-primary)]"
              />
            </div>
          </div>
          {selectedLayer.shapeType === 'rectangle' && (
            <div className="flex items-center justify-between">
              <span>Corner radius</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedLayer.cornerRadius || 0}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { cornerRadius: Number(e.target.value) })
                  }
                  className="w-24 cursor-pointer"
                />
                <span className="font-mono-ui text-[11px] w-8">
                  {selectedLayer.cornerRadius || 0}
                </span>
              </div>
            </div>
          )}
          {selectedLayer.shapeType === 'polygon' && (
            <div className="flex items-center justify-between">
              <span>Sides</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="3"
                  max="12"
                  value={selectedLayer.sides || 6}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { sides: Number(e.target.value) })
                  }
                  className="w-24 cursor-pointer"
                />
                <span className="font-mono-ui text-[11px] w-8">{selectedLayer.sides || 6}</span>
              </div>
            </div>
          )}
          {(selectedLayer.shapeType === 'arc' || selectedLayer.shapeType === 'wedge') && (
            <div className="flex items-center justify-between">
              <span>Angle</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="15"
                  max="360"
                  value={selectedLayer.angle || (selectedLayer.shapeType === 'arc' ? 270 : 60)}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { angle: Number(e.target.value) })
                  }
                  className="w-24 cursor-pointer"
                />
                <span className="font-mono-ui text-[11px] w-8">
                  {selectedLayer.angle || (selectedLayer.shapeType === 'arc' ? 270 : 60)}°
                </span>
              </div>
            </div>
          )}
          {(selectedLayer.shapeType === 'ring' ||
            selectedLayer.shapeType === 'arc' ||
            selectedLayer.shapeType === 'star') && (
            <div className="flex items-center justify-between">
              <span>Inner radius</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.15"
                  max="0.9"
                  step="0.05"
                  value={selectedLayer.innerRadius ?? 0.45}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { innerRadius: Number(e.target.value) })
                  }
                  className="w-24 cursor-pointer"
                />
                <span className="font-mono-ui text-[11px] w-8">
                  {Math.round((selectedLayer.innerRadius ?? 0.45) * 100)}%
                </span>
              </div>
            </div>
          )}
          {selectedLayer.shapeType === 'star' && (
            <div className="flex items-center justify-between">
              <span>Points</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="3"
                  max="12"
                  value={selectedLayer.sides || 5}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { sides: Number(e.target.value) })
                  }
                  className="w-24 cursor-pointer"
                />
                <span className="font-mono-ui text-[11px] w-8">{selectedLayer.sides || 5}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
            Stroke & border
          </span>
          <input
            type="color"
            value={styles.stroke || '#ffffff'}
            onChange={(e) => updateStyle('stroke', e.target.value)}
            className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Width</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="40"
              value={styles.strokeWidth || 0}
              onChange={(e) => updateStyle('strokeWidth', Number(e.target.value))}
              className="w-28 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] w-7 text-right">
              {styles.strokeWidth || 0}px
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
            Drop shadow
          </span>
          <input
            type="color"
            value={styles.shadowColor || '#000000'}
            onChange={(e) => updateStyle('shadowColor', e.target.value)}
            className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Blur</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="50"
              value={styles.shadowBlur || 0}
              onChange={(e) => updateStyle('shadowBlur', Number(e.target.value))}
              className="w-28 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] w-7 text-right">
              {styles.shadowBlur || 0}px
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Opacity</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={styles.shadowOpacity || 0}
              onChange={(e) => updateStyle('shadowOpacity', Number(e.target.value))}
              className="w-28 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] w-7 text-right">
              {Math.round((styles.shadowOpacity || 0) * 100)}%
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={field}>
            <span className="text-[var(--text-faint)] text-[10px]">Off X</span>
            <input
              type="number"
              value={styles.shadowOffsetX || 0}
              onChange={(e) => updateStyle('shadowOffsetX', Number(e.target.value))}
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
          <div className={field}>
            <span className="text-[var(--text-faint)] text-[10px]">Off Y</span>
            <input
              type="number"
              value={styles.shadowOffsetY || 0}
              onChange={(e) => updateStyle('shadowOffsetY', Number(e.target.value))}
              className="bg-transparent w-full text-[var(--text-primary)] outline-none font-mono-ui"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Sparkles size={11} className="text-[var(--accent-hot)]" /> Outer glow
          </span>
          <input
            type="color"
            value={styles.outerGlowColor || '#e8a84a'}
            onChange={(e) => updateStyle('outerGlowColor', e.target.value)}
            className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
          />
        </div>
        <p className="text-[10px] text-[var(--text-faint)] -mt-1">
          Soft halo around the layer. Active when blur &gt; 0 (overrides drop shadow).
        </p>
        <div className="flex items-center justify-between">
          <span>Glow blur</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="60"
              value={styles.outerGlowBlur || 0}
              onChange={(e) => updateStyle('outerGlowBlur', Number(e.target.value))}
              className="w-28 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] w-7 text-right">
              {styles.outerGlowBlur || 0}px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
