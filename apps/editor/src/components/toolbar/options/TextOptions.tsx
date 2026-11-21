import React from 'react';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { FontPicker } from '../../ui/FontPicker';
import { loadGoogleFont } from '../../../utils/googleFonts';
import { ColorOpt, OptHint, SizeOpt } from '../../ui/OptionControls';

export const TextOptions: React.FC = () => {
  const textSettings = useEditorStore((s) => s.textSettings);
  const updateTextSettings = useEditorStore((s) => s.updateTextSettings);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  return (
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
  );
};
