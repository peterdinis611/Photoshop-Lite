import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Square,
  Paintbrush,
  Plus,
  Scissors,
  Layers,
  VenetianMask,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { BlendMode, EditorLayer } from '../../types/editor';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

const LayerThumb: React.FC<{ layer: EditorLayer }> = ({ layer }) => {
  if (layer.type === 'image') {
    return (
      <div className="w-8 h-8 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-app)] shrink-0">
        <img src={layer.src} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    );
  }
  if (layer.type === 'shape') {
    return (
      <div
        className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] shrink-0"
        style={{ background: layer.fill }}
      />
    );
  }
  if (layer.type === 'text') {
    return (
      <div className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-center shrink-0">
        <Type size={12} className="text-[var(--accent-hot)]" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-center shrink-0">
      <Paintbrush size={12} className="text-[var(--ink-blue)]" />
    </div>
  );
};

export const LayersPanel: React.FC = () => {
  const {
    layers,
    selectedLayerId,
    selectLayer,
    removeLayer,
    duplicateLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    renameLayer,
    setLayerBlendMode,
    setLayerOpacity,
    reorderLayers,
    addTextLayer,
    addShapeLayer,
    setClippingMask,
    removeClippingMask,
    toggleLayerMask,
  } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const reversedLayers = [...layers]
    .map((layer, index) => ({ layer, originalIndex: index }))
    .reverse();

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      renameLayer(id, editingName.trim());
    }
    setEditingId(null);
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon size={11} className="text-[var(--ink-blue)]" />;
      case 'text':
        return <Type size={11} className="text-[var(--accent-hot)]" />;
      case 'shape':
        return <Square size={11} className="text-[var(--success)]" />;
      case 'drawing':
        return <Paintbrush size={11} className="text-[var(--text-muted)]" />;
      default:
        return <ImageIcon size={11} />;
    }
  };

  const layerBelowSelected = selectedLayerId
    ? (() => {
        const idx = layers.findIndex((l) => l.id === selectedLayerId);
        return idx > 0 ? layers[idx - 1] : null;
      })()
    : null;

  const isClipped = !!selectedLayer?.clippingMaskToId;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] select-none text-xs animate-panel-in">
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)] font-medium">Blend</span>
          <select
            disabled={!selectedLayer}
            value={selectedLayer?.blendMode || 'source-over'}
            onChange={(e) => {
              if (selectedLayer) {
                setLayerBlendMode(selectedLayer.id, e.target.value as BlendMode);
              }
            }}
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-40 cursor-pointer w-36"
          >
            {BLEND_MODES.map((bm) => (
              <option key={bm.value} value={bm.value}>
                {bm.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)] font-medium">Opacity</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!selectedLayer}
              value={selectedLayer?.opacity ?? 1}
              onChange={(e) => {
                if (selectedLayer) {
                  setLayerOpacity(selectedLayer.id, Number(e.target.value));
                }
              }}
              className="w-24 disabled:opacity-40 cursor-pointer"
            />
            <span className="font-mono-ui text-[11px] text-[var(--text-muted)] w-9 text-right">
              {Math.round((selectedLayer?.opacity ?? 1) * 100)}%
            </span>
          </div>
        </div>

        {selectedLayer && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              title={
                isClipped
                  ? 'Release Clipping Mask'
                  : `Clip to layer below${layerBelowSelected ? ` ("${layerBelowSelected.name}")` : ' — no layer below'}`
              }
              disabled={!isClipped && !layerBelowSelected}
              onClick={() => {
                if (isClipped) {
                  removeClippingMask(selectedLayer.id);
                } else if (layerBelowSelected) {
                  setClippingMask(selectedLayer.id, layerBelowSelected.id);
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer border ${
                isClipped
                  ? 'bg-[var(--accent-dim)] text-[var(--accent-hot)] border-[var(--accent)]/40'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] disabled:opacity-30'
              }`}
            >
              <Scissors size={11} />
              {isClipped ? 'Clipped' : 'Clip to Below'}
            </button>

            <button
              title={selectedLayer.hasLayerMask ? 'Remove Layer Mask' : 'Add Layer Mask'}
              onClick={() => toggleLayerMask(selectedLayer.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer border ${
                selectedLayer.hasLayerMask
                  ? 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/35'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              {selectedLayer.hasLayerMask ? <VenetianMask size={11} /> : <Layers size={11} />}
              {selectedLayer.hasLayerMask ? 'Remove Mask' : 'Add Mask'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {reversedLayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-[var(--text-faint)] text-center px-4">
            No layers yet. Place an image or add text/shapes.
          </div>
        ) : (
          reversedLayers.map(({ layer, originalIndex }) => {
            const isSelected = layer.id === selectedLayerId;
            const isClippedLayer = !!layer.clippingMaskToId;

            return (
              <div
                key={layer.id}
                onClick={() => selectLayer(layer.id)}
                className={`flex items-center justify-between p-1.5 rounded-[var(--radius-md)] border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)]/55 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                } ${isClippedLayer ? 'ml-3 border-l-2 border-l-[var(--accent)]' : ''}`}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1.5 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layer.id);
                    }}
                    className={`p-1 rounded cursor-pointer ${
                      layer.visible ? 'text-[var(--text-muted)]' : 'text-[var(--text-faint)]'
                    }`}
                    title={layer.visible ? 'Hide' : 'Show'}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  <LayerThumb layer={layer} />

                  <div className="flex flex-col min-w-0 flex-1">
                    {editingId === layer.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveRename(layer.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(layer.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="bg-[var(--bg-app)] border border-[var(--accent)] px-1.5 py-0.5 rounded text-[var(--text-primary)] text-xs outline-none w-full"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => handleStartRename(layer.id, layer.name)}
                        className="truncate font-medium text-[11px] select-none leading-tight"
                        title="Double-click to rename"
                      >
                        {layer.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[9px] text-[var(--text-faint)] font-mono-ui uppercase tracking-wide">
                      {getLayerIcon(layer.type)}
                      {layer.type}
                      {layer.hasLayerMask && ' · mask'}
                      {isClippedLayer && ' · clip'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-[var(--text-faint)] shrink-0">
                  <button
                    disabled={originalIndex === layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayers(originalIndex, originalIndex + 1);
                    }}
                    className="p-1 hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer"
                    title="Move Up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    disabled={originalIndex === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayers(originalIndex, originalIndex - 1);
                    }}
                    className="p-1 hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer"
                    title="Move Down"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerLock(layer.id);
                    }}
                    className={`p-1 hover:text-[var(--text-primary)] cursor-pointer ${
                      layer.locked ? 'text-[var(--accent-hot)]' : ''
                    }`}
                    title={layer.locked ? 'Unlock' : 'Lock'}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateLayer(layer.id);
                    }}
                    className="p-1 hover:text-[var(--text-primary)] cursor-pointer"
                    title="Duplicate"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    className="p-1 hover:text-[var(--danger)] cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-toolbar)] flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-faint)] font-mono-ui">
          {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => addTextLayer()}
            className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[11px] font-medium cursor-pointer"
          >
            <Plus size={11} /> Text
          </button>
          <button
            onClick={() => addShapeLayer('rectangle')}
            className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[11px] font-medium cursor-pointer"
          >
            <Plus size={11} /> Shape
          </button>
        </div>
      </div>
    </div>
  );
};
