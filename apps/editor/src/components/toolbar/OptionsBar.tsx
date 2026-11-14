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
  RotateCw,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { TransformMode } from '../../types/editor';
import { FontPicker } from '../ui/FontPicker';
import { loadGoogleFont } from '../../utils/googleFonts';
import {
  ColorOpt,
  OptChip,
  OptHint,
  OptLabel,
  OptSep,
  SizeOpt,
} from '../ui/OptionControls';

const SHAPE_TYPES = [
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
] as const;

export const OptionsBar: React.FC = () => {
  const {
    activeTool,
    activeShapeType,
    setActiveShapeType,
    brushSettings,
    updateBrushSettings,
    penSettings,
    updatePenSettings,
    shapeSettings,
    updateShapeSettings,
    textSettings,
    updateTextSettings,
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
    gradientSettings,
    updateGradientSettings,
    toneBrushSettings,
    updateToneBrushSettings,
    transformMode,
    setTransformMode,
  } = useEditorStore();

  const stops = gradientSettings.colorStops;
  const stopStart = stops[0]?.color ?? '#000000';
  const stopEnd = stops[stops.length - 1]?.color ?? '#ffffff';
  const setEndStop = (which: 'start' | 'end', color: string) => {
    const next = stops.map((st, i) =>
      (which === 'start' && i === 0) || (which === 'end' && i === stops.length - 1)
        ? { ...st, color }
        : st
    );
    updateGradientSettings({ colorStops: next });
  };
  const gradientCss = `linear-gradient(90deg, ${[...stops]
    .sort((a, b) => a.offset - b.offset)
    .map((st) => `${st.color} ${Math.round(st.offset * 100)}%`)
    .join(', ')})`;

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
    lasso: 'Lasso',
    polyLasso: 'Polygonal Lasso',
    magneticLasso: 'Magnetic Lasso',
    quickSelect: 'Quick Select',
    wand: 'Wand',
    crop: 'Crop',
    brush: 'Brush',
    eraser: 'Eraser',
    refineBrush: 'Refine Edge',
    spotHealing: 'Spot Heal',
    healing: 'Healing Brush',
    patch: 'Patch',
    gradient: 'Gradient',
    dodge: 'Dodge',
    burn: 'Burn',
    sharpenTool: 'Sharpen',
    liquify: 'Liquify',
    transform: 'Transform',
    clone: 'Clone Stamp',
    eyedropper: 'Eyedropper',
    fill: 'Paint Bucket',
    blur: 'Blur',
    text: 'Type',
    shape: 'Shape',
    pen: 'Pen',
    hand: 'Hand',
    zoom: 'Zoom',
  };

  return (
    <div className="shell-options h-9 bg-[var(--bg-toolbar)] border-b border-[var(--border-subtle)] px-3 flex items-center gap-3 text-[11px] text-[var(--text-muted)] select-none overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-[var(--border-subtle)]">
        <Move size={12} className="text-[var(--accent)]" />
        <span className="font-display font-bold text-[var(--text-primary)] text-[11px]">
          {toolLabel[activeTool] || activeTool}
        </span>
      </div>

      {/* ── Move / Select ── */}
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
              <OptSep />
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
              <SizeOpt
                label="Opacity"
                value={selectedLayer.opacity}
                min={0}
                max={1}
                step={0.05}
                onCommit={(opacity) => updateLayer(selectedLayer.id, { opacity })}
              />

              {selectedLayer.type === 'shape' && (
                <>
                  <OptSep />
                  <ColorOpt
                    label="Fill"
                    value={selectedLayer.fill}
                    onChange={(fill) => updateLayer(selectedLayer.id, { fill })}
                    allowNone
                    isNone={selectedLayer.fill === 'transparent'}
                    onNone={() => updateLayer(selectedLayer.id, { fill: 'transparent' })}
                  />
                  <ColorOpt
                    label="Stroke"
                    value={selectedLayer.stroke}
                    onChange={(stroke) => updateLayer(selectedLayer.id, { stroke })}
                    allowNone
                    isNone={selectedLayer.stroke === 'transparent' || selectedLayer.strokeWidth === 0}
                    onNone={() => updateLayer(selectedLayer.id, { strokeWidth: 0 })}
                  />
                  <SizeOpt
                    label="Weight"
                    value={selectedLayer.strokeWidth}
                    min={0}
                    max={40}
                    unit="px"
                    onCommit={(strokeWidth) => updateLayer(selectedLayer.id, { strokeWidth })}
                  />
                  {(selectedLayer.shapeType === 'rectangle' ||
                    selectedLayer.shapeType === 'callout') && (
                    <SizeOpt
                      label="Radius"
                      value={selectedLayer.cornerRadius ?? 0}
                      min={0}
                      max={80}
                      onCommit={(cornerRadius) => updateLayer(selectedLayer.id, { cornerRadius })}
                    />
                  )}
                </>
              )}

              {selectedLayer.type === 'path' && (
                <>
                  <OptSep />
                  <ColorOpt
                    label="Stroke"
                    value={selectedLayer.stroke}
                    onChange={(stroke) => updateLayer(selectedLayer.id, { stroke })}
                  />
                  <SizeOpt
                    label="Weight"
                    value={selectedLayer.strokeWidth}
                    min={1}
                    max={40}
                    unit="px"
                    onCommit={(strokeWidth) => updateLayer(selectedLayer.id, { strokeWidth })}
                  />
                  <ColorOpt
                    label="Fill"
                    value={selectedLayer.fill === 'transparent' ? '#000000' : selectedLayer.fill}
                    onChange={(fill) => updateLayer(selectedLayer.id, { fill })}
                    allowNone
                    isNone={selectedLayer.fill === 'transparent'}
                    onNone={() => updateLayer(selectedLayer.id, { fill: 'transparent' })}
                  />
                </>
              )}

              {selectedLayer.type === 'text' && (
                <>
                  <OptSep />
                  <ColorOpt
                    label="Fill"
                    value={selectedLayer.fill}
                    onChange={(fill) => updateLayer(selectedLayer.id, { fill })}
                  />
                  <ColorOpt
                    label="Stroke"
                    value={selectedLayer.stroke || '#000000'}
                    onChange={(stroke) => updateLayer(selectedLayer.id, { stroke })}
                    allowNone
                    isNone={!selectedLayer.strokeWidth}
                    onNone={() => updateLayer(selectedLayer.id, { strokeWidth: 0 })}
                  />
                  <SizeOpt
                    label="Weight"
                    value={selectedLayer.strokeWidth ?? 0}
                    min={0}
                    max={12}
                    unit="px"
                    onCommit={(strokeWidth) => updateLayer(selectedLayer.id, { strokeWidth })}
                  />
                  <SizeOpt
                    label="Size"
                    value={selectedLayer.fontSize}
                    min={8}
                    max={200}
                    unit="px"
                    onCommit={(fontSize) => updateLayer(selectedLayer.id, { fontSize })}
                  />
                </>
              )}
            </>
          ) : (
            <OptHint>No layer selected — click a layer or press V</OptHint>
          )}
        </div>
      )}

      {/* ── Marquee ── */}
      {activeTool === 'marquee' && (
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <OptChip active={marqueeMode === 'rect'} onClick={() => setMarqueeMode('rect')}>
              Rect
            </OptChip>
            <OptChip active={marqueeMode === 'ellipse'} onClick={() => setMarqueeMode('ellipse')}>
              Ellipse
            </OptChip>
          </div>
          <OptHint>
            Drag to select · <kbd className="text-[var(--accent-hot)]">Del</kbd> clears ·{' '}
            <kbd className="text-[var(--accent-hot)]">Esc</kbd> deselects
          </OptHint>
          {marqueeSelection && (
            <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
          )}
        </div>
      )}

      {activeTool === 'lasso' && (
        <div className="flex items-center gap-3">
          <OptHint>
            Drag freehand · release to close · <kbd className="text-[var(--accent-hot)]">Del</kbd>{' '}
            clears
          </OptHint>
          {marqueeSelection && (
            <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
          )}
        </div>
      )}

      {activeTool === 'polyLasso' && (
        <div className="flex items-center gap-3">
          <OptHint>
            Click to add points · double-click or{' '}
            <kbd className="text-[var(--accent-hot)]">Enter</kbd> to close ·{' '}
            <kbd className="text-[var(--accent-hot)]">Esc</kbd> cancels
          </OptHint>
          {marqueeSelection && (
            <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
          )}
        </div>
      )}

      {activeTool === 'magneticLasso' && (
        <div className="flex items-center gap-3">
          <OptHint>Trace along an edge — the path snaps to contrast · click to close</OptHint>
          {marqueeSelection && (
            <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
          )}
        </div>
      )}

      {activeTool === 'quickSelect' && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Tolerance"
            value={wandTolerance}
            min={0}
            max={96}
            onCommit={setWandTolerance}
          />
          <OptHint>Paint over the subject — selection grows to similar edges</OptHint>
          {marqueeSelection && (
            <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
          )}
        </div>
      )}

      {activeTool === 'wand' && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Tolerance"
            value={wandTolerance}
            min={0}
            max={96}
            onCommit={setWandTolerance}
          />
          <ColorOpt
            label="Sample"
            value={brushSettings.color}
            onChange={(color) => updateBrushSettings({ color })}
          />
          <OptHint>Click similar color region on an image layer</OptHint>
        </div>
      )}

      {/* ── Brush / Eraser / healing family ── */}
      {(activeTool === 'brush' ||
        activeTool === 'eraser' ||
        activeTool === 'clone' ||
        activeTool === 'spotHealing') && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Size"
            value={brushSettings.size}
            min={2}
            max={150}
            unit="px"
            onCommit={(size) => updateBrushSettings({ size })}
            widthClass="w-24"
          />
          <SizeOpt
            label="Hardness"
            value={brushSettings.hardness}
            min={0}
            max={1}
            step={0.05}
            onCommit={(hardness) => updateBrushSettings({ hardness })}
          />
          <SizeOpt
            label="Opacity"
            value={brushSettings.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(opacity) => updateBrushSettings({ opacity })}
          />
          {(activeTool === 'brush' || activeTool === 'eraser') &&
            brushSettings.flow !== undefined && (
              <SizeOpt
                label="Flow"
                value={brushSettings.flow}
                min={0.05}
                max={1}
                step={0.05}
                onCommit={(flow) => updateBrushSettings({ flow })}
              />
            )}
          {activeTool === 'brush' && (
            <ColorOpt
              label="Color"
              value={brushSettings.color}
              onChange={(color) => updateBrushSettings({ color })}
            />
          )}
          {activeTool === 'brush' && (
            <OptHint>
              <kbd>[</kbd>/<kbd>]</kbd> size · <kbd>X</kbd> swap
            </OptHint>
          )}
          {activeTool === 'eraser' && <OptHint>Erase strokes / pixels on active layer</OptHint>}
          {activeTool === 'clone' && <OptHint>Alt+click source · drag to paint</OptHint>}
          {activeTool === 'spotHealing' && <OptHint>Drag over blemishes on image layer</OptHint>}
        </div>
      )}

      {activeTool === 'fill' && (
        <div className="flex items-center gap-3">
          <ColorOpt
            label="Fill"
            value={brushSettings.color}
            onChange={(color) => updateBrushSettings({ color })}
          />
          <SizeOpt
            label="Tolerance"
            value={wandTolerance}
            min={0}
            max={96}
            onCommit={setWandTolerance}
          />
          <SizeOpt
            label="Opacity"
            value={brushSettings.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(opacity) => updateBrushSettings({ opacity })}
          />
          <OptHint>Click image region to flood-fill</OptHint>
        </div>
      )}

      {activeTool === 'blur' && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Radius"
            value={brushSettings.size}
            min={6}
            max={80}
            unit="px"
            onCommit={(size) => updateBrushSettings({ size })}
            widthClass="w-24"
          />
          <SizeOpt
            label="Strength"
            value={brushSettings.opacity}
            min={0.2}
            max={1}
            step={0.05}
            onCommit={(opacity) => updateBrushSettings({ opacity })}
          />
          <SizeOpt
            label="Hardness"
            value={brushSettings.hardness}
            min={0}
            max={1}
            step={0.05}
            onCommit={(hardness) => updateBrushSettings({ hardness })}
          />
          <OptHint>Click / drag to soften areas</OptHint>
        </div>
      )}

      {/* ── Gradient ── */}
      {activeTool === 'gradient' && (
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
            <OptChip
              active={gradientSettings.gradientType === 'linear'}
              onClick={() => updateGradientSettings({ gradientType: 'linear' })}
            >
              Linear
            </OptChip>
            <OptChip
              active={gradientSettings.gradientType === 'radial'}
              onClick={() => updateGradientSettings({ gradientType: 'radial' })}
            >
              Radial
            </OptChip>
          </div>
          <OptSep />
          <ColorOpt label="From" value={stopStart} onChange={(c) => setEndStop('start', c)} />
          <div
            title="Gradient preview"
            className="h-4 w-24 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] shadow-inner"
            style={{ background: gradientCss }}
          />
          <ColorOpt label="To" value={stopEnd} onChange={(c) => setEndStop('end', c)} />
          <button
            type="button"
            title="Reverse stops"
            onClick={() =>
              updateGradientSettings({
                colorStops: stops.map((st) => ({ ...st, offset: 1 - st.offset })).reverse(),
              })
            }
            className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
          >
            <ArrowLeftRight size={12} />
          </button>
          <SizeOpt
            label="Opacity"
            value={gradientSettings.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(opacity) => updateGradientSettings({ opacity })}
          />
          <OptHint>Drag on canvas to set direction</OptHint>
        </div>
      )}

      {/* ── Dodge / Burn / Sharpen ── */}
      {(activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sharpenTool') && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Size"
            value={toneBrushSettings.size}
            min={4}
            max={200}
            unit="px"
            onCommit={(size) => updateToneBrushSettings({ size })}
            widthClass="w-24"
          />
          <SizeOpt
            label="Hardness"
            value={toneBrushSettings.hardness}
            min={0}
            max={1}
            step={0.05}
            onCommit={(hardness) => updateToneBrushSettings({ hardness })}
          />
          <SizeOpt
            label="Exposure"
            value={toneBrushSettings.exposure}
            min={1}
            max={100}
            unit="%"
            onCommit={(exposure) => updateToneBrushSettings({ exposure })}
          />
          {activeTool !== 'sharpenTool' && (
            <>
              <OptSep />
              <OptLabel>Range</OptLabel>
              <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
                {(['shadows', 'midtones', 'highlights'] as const).map((range) => (
                  <OptChip
                    key={range}
                    active={toneBrushSettings.range === range}
                    onClick={() => updateToneBrushSettings({ range })}
                  >
                    {range}
                  </OptChip>
                ))}
              </div>
            </>
          )}
          <OptHint>
            {activeTool === 'dodge'
              ? 'Paint to lighten'
              : activeTool === 'burn'
                ? 'Paint to darken'
                : 'Paint to add local detail'}
          </OptHint>
        </div>
      )}

      {/* ── Healing / Patch ── */}
      {(activeTool === 'healing' || activeTool === 'patch') && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Size"
            value={brushSettings.size}
            min={2}
            max={150}
            unit="px"
            onCommit={(size) => updateBrushSettings({ size })}
            widthClass="w-24"
          />
          <SizeOpt
            label="Hardness"
            value={brushSettings.hardness}
            min={0}
            max={1}
            step={0.05}
            onCommit={(hardness) => updateBrushSettings({ hardness })}
          />
          <OptHint>
            {activeTool === 'healing'
              ? 'Alt+click source · drag to heal'
              : 'Draw an area · drag it onto clean texture'}
          </OptHint>
        </div>
      )}

      {/* ── Liquify ── */}
      {activeTool === 'liquify' && (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Size"
            value={brushSettings.size}
            min={10}
            max={200}
            unit="px"
            onCommit={(size) => updateBrushSettings({ size })}
            widthClass="w-24"
          />
          <OptHint>Drag to push pixels on the active image layer</OptHint>
        </div>
      )}

      {/* ── Transform ── */}
      {activeTool === 'transform' && (
        <div className="flex items-center gap-2">
          <OptLabel>Mode</OptLabel>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
            {(['free', 'skew', 'distort', 'perspective', 'warp'] as TransformMode[]).map(
              (mode) => (
                <OptChip
                  key={mode}
                  active={transformMode === mode}
                  onClick={() => setTransformMode(mode)}
                >
                  {mode}
                </OptChip>
              )
            )}
          </div>
          {!selectedLayer && <OptHint>Select a layer to transform</OptHint>}
        </div>
      )}

      {activeTool === 'refineBrush' && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[var(--accent-hot)] font-semibold">
            <Sparkles size={12} /> Edge
          </span>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
            <OptChip
              active={brushSettings.refineMode === 'erase'}
              onClick={() => updateBrushSettings({ refineMode: 'erase' })}
            >
              Erase
            </OptChip>
            <OptChip
              active={brushSettings.refineMode === 'restore'}
              onClick={() => updateBrushSettings({ refineMode: 'restore' })}
            >
              Restore
            </OptChip>
          </div>
          <SizeOpt
            label="Radius"
            value={brushSettings.size}
            min={4}
            max={80}
            unit="px"
            onCommit={(size) => updateBrushSettings({ size })}
            widthClass="w-24"
          />
          <SizeOpt
            label="Hardness"
            value={brushSettings.hardness}
            min={0}
            max={1}
            step={0.05}
            onCommit={(hardness) => updateBrushSettings({ hardness })}
          />
          <SizeOpt
            label="Opacity"
            value={brushSettings.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(opacity) => updateBrushSettings({ opacity })}
          />
        </div>
      )}

      {/* ── Crop ── */}
      {activeTool === 'crop' && (
        <div className="flex items-center gap-2">
          <OptLabel>Ratio</OptLabel>
          {(['free', '1:1', '16:9', '4:3', '3:2', '9:16'] as const).map((ratio) => (
            <OptChip
              key={ratio}
              active={cropSettings.aspect === ratio}
              onClick={() => {
                let w = cropSettings.width;
                let h = cropSettings.height;
                if (ratio === '1:1') {
                  const s = Math.min(w, h);
                  w = s;
                  h = s;
                } else if (ratio === '16:9') h = Math.round((w * 9) / 16);
                else if (ratio === '4:3') h = Math.round((w * 3) / 4);
                else if (ratio === '3:2') h = Math.round((w * 2) / 3);
                else if (ratio === '9:16') w = Math.round((h * 9) / 16);
                setCropSettings({ aspect: ratio, width: w, height: h });
              }}
            >
              {ratio === 'free' ? 'Free' : ratio}
            </OptChip>
          ))}
          <OptSep />
          <OptLabel>Rotate</OptLabel>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <button
              type="button"
              title="Rotate 90° CCW"
              disabled={!selectedLayer}
              onClick={() => {
                if (!selectedLayer) return;
                const next = ((selectedLayer.rotation - 90) % 360 + 360) % 360;
                updateLayer(selectedLayer.id, { rotation: next });
                setCropSettings({ rotation: next });
              }}
              className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              title="Rotate 90° CW"
              disabled={!selectedLayer}
              onClick={() => {
                if (!selectedLayer) return;
                const next = ((selectedLayer.rotation + 90) % 360 + 360) % 360;
                updateLayer(selectedLayer.id, { rotation: next });
                setCropSettings({ rotation: next });
              }}
              className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <RotateCw size={13} />
            </button>
          </div>
          <OptSep />
          <button
            onClick={() => void applyCrop()}
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

      {/* ── Text ── */}
      {(activeTool === 'text' || (activeTool === 'select' && selectedLayer?.type === 'text')) &&
        activeTool !== 'select' && (
        <div className="flex items-center gap-2.5">
          {selectedLayer?.type !== 'text' && (
            <OptHint>Set style below · click canvas to place</OptHint>
          )}
          <FontPicker
            value={
              selectedLayer?.type === 'text'
                ? selectedLayer.fontFamily
                : textSettings.fontFamily
            }
            onChange={async (family) => {
              await loadGoogleFont(family);
              updateTextSettings({ fontFamily: family });
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { fontFamily: family });
              }
            }}
          />
          <SizeOpt
            label="Size"
            value={
              selectedLayer?.type === 'text' ? selectedLayer.fontSize : textSettings.fontSize
            }
            min={8}
            max={200}
            unit="px"
            onCommit={(fontSize) => {
              updateTextSettings({ fontSize });
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { fontSize });
              }
            }}
          />
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => {
                const current =
                  selectedLayer?.type === 'text'
                    ? selectedLayer.fontStyle
                    : textSettings.fontStyle;
                const next = current.includes('bold')
                  ? (current.replace('bold', '').trim() || 'normal')
                  : current.includes('italic')
                    ? 'bold italic'
                    : 'bold';
                updateTextSettings({ fontStyle: next as typeof textSettings.fontStyle });
                if (selectedLayer?.type === 'text') {
                  updateLayer(selectedLayer.id, { fontStyle: next as typeof textSettings.fontStyle });
                }
              }}
              className={`p-1 rounded cursor-pointer ${
                (selectedLayer?.type === 'text'
                  ? selectedLayer.fontStyle
                  : textSettings.fontStyle
                ).includes('bold')
                  ? 'bg-[var(--accent)] text-[#1a1208]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Bold size={12} />
            </button>
            <button
              onClick={() => {
                const current =
                  selectedLayer?.type === 'text'
                    ? selectedLayer.fontStyle
                    : textSettings.fontStyle;
                const next = current.includes('italic')
                  ? (current.replace('italic', '').trim() || 'normal')
                  : current.includes('bold')
                    ? 'bold italic'
                    : 'italic';
                updateTextSettings({ fontStyle: next as typeof textSettings.fontStyle });
                if (selectedLayer?.type === 'text') {
                  updateLayer(selectedLayer.id, { fontStyle: next as typeof textSettings.fontStyle });
                }
              }}
              className={`p-1 rounded cursor-pointer ${
                (selectedLayer?.type === 'text'
                  ? selectedLayer.fontStyle
                  : textSettings.fontStyle
                ).includes('italic')
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
                  updateTextSettings({ align });
                  if (selectedLayer?.type === 'text') {
                    updateLayer(selectedLayer.id, { align });
                  }
                }}
                className={`p-1 rounded cursor-pointer ${
                  (selectedLayer?.type === 'text' ? selectedLayer.align : textSettings.align) ===
                  align
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {align === 'left' ? (
                  <AlignLeft size={12} />
                ) : align === 'center' ? (
                  <AlignCenter size={12} />
                ) : (
                  <AlignRight size={12} />
                )}
              </button>
            ))}
          </div>
          <ColorOpt
            label="Fill"
            value={selectedLayer?.type === 'text' ? selectedLayer.fill : textSettings.fill}
            onChange={(fill) => {
              updateTextSettings({ fill });
              if (selectedLayer?.type === 'text') updateLayer(selectedLayer.id, { fill });
            }}
          />
          <ColorOpt
            label="Stroke"
            value={
              selectedLayer?.type === 'text'
                ? selectedLayer.stroke || textSettings.stroke
                : textSettings.stroke
            }
            onChange={(stroke) => {
              updateTextSettings({ stroke });
              if (selectedLayer?.type === 'text') updateLayer(selectedLayer.id, { stroke });
            }}
            allowNone
            isNone={
              (selectedLayer?.type === 'text'
                ? selectedLayer.strokeWidth ?? 0
                : textSettings.strokeWidth) === 0
            }
            onNone={() => {
              updateTextSettings({ strokeWidth: 0, stroke: 'transparent' });
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { strokeWidth: 0, stroke: 'transparent' });
              }
            }}
          />
          <SizeOpt
            label="Weight"
            value={
              selectedLayer?.type === 'text'
                ? selectedLayer.strokeWidth ?? 0
                : textSettings.strokeWidth
            }
            min={0}
            max={12}
            unit="px"
            onCommit={(strokeWidth) => {
              updateTextSettings({ strokeWidth });
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { strokeWidth });
              }
            }}
          />
          <SizeOpt
            label="Track"
            value={
              selectedLayer?.type === 'text'
                ? selectedLayer.letterSpacing
                : textSettings.letterSpacing
            }
            min={-20}
            max={40}
            onCommit={(letterSpacing) => {
              updateTextSettings({ letterSpacing });
              if (selectedLayer?.type === 'text') {
                updateLayer(selectedLayer.id, { letterSpacing });
              }
            }}
          />
        </div>
      )}

      {/* ── Pen ── */}
      {activeTool === 'pen' && (
        <div className="flex items-center gap-3">
          <ColorOpt
            label="Stroke"
            value={
              selectedLayer?.type === 'path' ? selectedLayer.stroke : penSettings.stroke
            }
            onChange={(stroke) => {
              updatePenSettings({ stroke });
              if (selectedLayer?.type === 'path') updateLayer(selectedLayer.id, { stroke });
            }}
          />
          <SizeOpt
            label="Weight"
            value={
              selectedLayer?.type === 'path'
                ? selectedLayer.strokeWidth
                : penSettings.strokeWidth
            }
            min={1}
            max={40}
            unit="px"
            onCommit={(strokeWidth) => {
              updatePenSettings({ strokeWidth });
              if (selectedLayer?.type === 'path') {
                updateLayer(selectedLayer.id, { strokeWidth });
              }
            }}
          />
          <ColorOpt
            label="Fill"
            value={
              (selectedLayer?.type === 'path' ? selectedLayer.fill : penSettings.fill) ===
              'transparent'
                ? '#000000'
                : selectedLayer?.type === 'path'
                  ? selectedLayer.fill
                  : penSettings.fill
            }
            onChange={(fill) => {
              updatePenSettings({ fill });
              if (selectedLayer?.type === 'path') updateLayer(selectedLayer.id, { fill });
            }}
            allowNone
            isNone={
              (selectedLayer?.type === 'path' ? selectedLayer.fill : penSettings.fill) ===
              'transparent'
            }
            onNone={() => {
              updatePenSettings({ fill: 'transparent' });
              if (selectedLayer?.type === 'path') {
                updateLayer(selectedLayer.id, { fill: 'transparent' });
              }
            }}
          />
          <SizeOpt
            label="Snap"
            value={penSettings.closeThreshold}
            min={4}
            max={32}
            unit="px"
            onCommit={(closeThreshold) => updatePenSettings({ closeThreshold })}
          />
          <OptHint>
            Click · drag curves · first closes · <kbd className="text-[var(--accent-hot)]">Enter</kbd>{' '}
            · <kbd className="text-[var(--accent-hot)]">Esc</kbd>
          </OptHint>
        </div>
      )}

      {/* ── Shape ── */}
      {activeTool === 'shape' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {SHAPE_TYPES.map((type) => (
              <OptChip
                key={type}
                active={activeShapeType === type}
                onClick={() => setActiveShapeType(type)}
              >
                {type}
              </OptChip>
            ))}
          </div>
          <OptSep />
          <ColorOpt
            label="Fill"
            value={
              selectedLayer?.type === 'shape' ? selectedLayer.fill : shapeSettings.fill
            }
            onChange={(fill) => {
              updateShapeSettings({ fill });
              if (selectedLayer?.type === 'shape') updateLayer(selectedLayer.id, { fill });
            }}
            allowNone
            isNone={
              (selectedLayer?.type === 'shape' ? selectedLayer.fill : shapeSettings.fill) ===
              'transparent'
            }
            onNone={() => {
              updateShapeSettings({ fill: 'transparent' });
              if (selectedLayer?.type === 'shape') {
                updateLayer(selectedLayer.id, { fill: 'transparent' });
              }
            }}
          />
          <ColorOpt
            label="Stroke"
            value={
              selectedLayer?.type === 'shape' ? selectedLayer.stroke : shapeSettings.stroke
            }
            onChange={(stroke) => {
              updateShapeSettings({ stroke });
              if (selectedLayer?.type === 'shape') updateLayer(selectedLayer.id, { stroke });
            }}
          />
          <SizeOpt
            label="Weight"
            value={
              selectedLayer?.type === 'shape'
                ? selectedLayer.strokeWidth
                : shapeSettings.strokeWidth
            }
            min={0}
            max={40}
            unit="px"
            onCommit={(strokeWidth) => {
              updateShapeSettings({ strokeWidth });
              if (selectedLayer?.type === 'shape') {
                updateLayer(selectedLayer.id, { strokeWidth });
              }
            }}
          />
          <SizeOpt
            label="Opacity"
            value={
              selectedLayer?.type === 'shape' ? selectedLayer.opacity : shapeSettings.opacity
            }
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(opacity) => {
              updateShapeSettings({ opacity });
              if (selectedLayer?.type === 'shape') {
                updateLayer(selectedLayer.id, { opacity });
              }
            }}
          />
          {(activeShapeType === 'rectangle' ||
            activeShapeType === 'callout' ||
            (selectedLayer?.type === 'shape' &&
              (selectedLayer.shapeType === 'rectangle' ||
                selectedLayer.shapeType === 'callout'))) && (
            <SizeOpt
              label="Radius"
              value={
                selectedLayer?.type === 'shape'
                  ? selectedLayer.cornerRadius ?? 0
                  : shapeSettings.cornerRadius
              }
              min={0}
              max={80}
              onCommit={(cornerRadius) => {
                updateShapeSettings({ cornerRadius });
                if (selectedLayer?.type === 'shape') {
                  updateLayer(selectedLayer.id, { cornerRadius });
                }
              }}
            />
          )}
          {selectedLayer?.type === 'shape' &&
            (selectedLayer.shapeType === 'polygon' || selectedLayer.shapeType === 'star') && (
              <SizeOpt
                label={selectedLayer.shapeType === 'star' ? 'Points' : 'Sides'}
                value={selectedLayer.sides || 5}
                min={3}
                max={12}
                onCommit={(sides) => updateLayer(selectedLayer.id, { sides })}
              />
            )}
          {selectedLayer?.type === 'shape' &&
            (selectedLayer.shapeType === 'arc' || selectedLayer.shapeType === 'wedge') && (
              <SizeOpt
                label="Angle"
                value={selectedLayer.angle || 60}
                min={15}
                max={360}
                unit="°"
                onCommit={(angle) => updateLayer(selectedLayer.id, { angle })}
              />
            )}
          {selectedLayer?.type === 'shape' &&
            (selectedLayer.shapeType === 'ring' || selectedLayer.shapeType === 'star') && (
              <SizeOpt
                label="Inner"
                value={selectedLayer.innerRadius ?? 0.45}
                min={0.15}
                max={0.9}
                step={0.05}
                onCommit={(innerRadius) => updateLayer(selectedLayer.id, { innerRadius })}
              />
            )}
        </div>
      )}

      {activeTool === 'hand' && (
        <OptHint>
          Drag to pan · hold <kbd className="font-mono-ui text-[var(--accent-hot)]">Space</kbd> ·
          scroll zoom
        </OptHint>
      )}

      {activeTool === 'zoom' && (
        <div className="flex items-center gap-3">
          <OptHint>
            Click zoom in · <kbd className="font-mono-ui text-[var(--accent-hot)]">Alt</kbd>+click
            out
          </OptHint>
          <span className="font-mono-ui text-[var(--text-primary)]">{Math.round(zoom * 100)}%</span>
          <OptChip onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>+</OptChip>
          <OptChip onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}>−</OptChip>
          <OptChip onClick={() => setZoom(1)}>100%</OptChip>
        </div>
      )}

      {activeTool === 'eyedropper' && (
        <div className="flex items-center gap-2">
          <OptHint>Click canvas to sample → brush / fill color</OptHint>
          <ColorOpt
            label="Active"
            value={brushSettings.color}
            onChange={(color) => updateBrushSettings({ color })}
          />
          <span className="font-mono-ui text-[var(--text-primary)] uppercase">
            {brushSettings.color}
          </span>
        </div>
      )}
    </div>
  );
};
