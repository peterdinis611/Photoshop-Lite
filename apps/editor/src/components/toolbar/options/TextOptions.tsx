import React from 'react';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { FontPicker } from '../../ui/FontPicker';
import { loadGoogleFont } from '../../../utils/googleFonts';
import { ColorOpt, NumOpt, OptHint, OptSep } from '../../ui/OptionControls';

export const TextOptions: React.FC = () => {
  const textSettings = useEditorStore((s) => s.textSettings);
  const updateTextSettings = useEditorStore((s) => s.updateTextSettings);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isText = selectedLayer?.type === 'text';

  const apply = <K extends keyof typeof textSettings>(
    key: K,
    value: (typeof textSettings)[K]
  ) => {
    updateTextSettings({ [key]: value } as Partial<typeof textSettings>);
    if (isText) {
      updateLayer(selectedLayer.id, { [key]: value } as Partial<typeof selectedLayer>);
    }
  };

  const fontFamily = isText ? selectedLayer.fontFamily : textSettings.fontFamily;
  const fontSize = isText ? selectedLayer.fontSize : textSettings.fontSize;
  const fontStyle = isText ? selectedLayer.fontStyle : textSettings.fontStyle;
  const align = isText ? selectedLayer.align : textSettings.align;
  const fill = isText ? selectedLayer.fill : textSettings.fill;
  const stroke = isText ? selectedLayer.stroke || textSettings.stroke : textSettings.stroke;
  const strokeWidth = isText ? selectedLayer.strokeWidth ?? 0 : textSettings.strokeWidth;
  const letterSpacing = isText ? selectedLayer.letterSpacing : textSettings.letterSpacing;
  const lineHeight = isText ? selectedLayer.lineHeight : textSettings.lineHeight;
  const boxWidth = isText ? selectedLayer.width : 240;

  return (
    <div className="type-options flex flex-nowrap items-center gap-2 min-w-0">
      {!isText && <OptHint>Click canvas to place</OptHint>}

      <FontPicker
        value={fontFamily}
        onChange={async (family) => {
          await loadGoogleFont(family);
          apply('fontFamily', family);
        }}
      />

      <NumOpt
        label="Size"
        value={fontSize}
        min={8}
        max={400}
        unit="px"
        widthClass="w-12"
        onCommit={(v) => apply('fontSize', v)}
      />
      <NumOpt
        label="Lead"
        value={Math.round(lineHeight * 100)}
        min={80}
        max={250}
        unit="%"
        widthClass="w-11"
        onCommit={(v) => apply('lineHeight', Math.round(v) / 100)}
      />
      {isText && (
        <NumOpt
          label="Box"
          value={Math.round(boxWidth)}
          min={40}
          max={Math.max(canvasWidth, 800)}
          unit="px"
          widthClass="w-12"
          onCommit={(width) => {
            updateLayer(selectedLayer.id, {
              width,
              height: Math.max(
                fontSize * lineHeight,
                Math.round(
                  fontSize * lineHeight * Math.max(1, selectedLayer.text.split('\n').length)
                )
              ),
            });
          }}
        />
      )}

      <OptSep />

      <div className="flex shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
        <button
          type="button"
          title="Bold"
          onClick={() => {
            const next = fontStyle.includes('bold')
              ? (fontStyle.replace('bold', '').trim() || 'normal')
              : fontStyle.includes('italic')
                ? 'bold italic'
                : 'bold';
            apply('fontStyle', next as typeof textSettings.fontStyle);
          }}
          className={`p-1 rounded cursor-pointer ${
            fontStyle.includes('bold')
              ? 'bg-[var(--accent)] text-[#1a1208]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Bold size={12} />
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => {
            const next = fontStyle.includes('italic')
              ? (fontStyle.replace('italic', '').trim() || 'normal')
              : fontStyle.includes('bold')
                ? 'bold italic'
                : 'italic';
            apply('fontStyle', next as typeof textSettings.fontStyle);
          }}
          className={`p-1 rounded cursor-pointer ${
            fontStyle.includes('italic')
              ? 'bg-[var(--accent)] text-[#1a1208]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Italic size={12} />
        </button>
      </div>

      <div className="flex shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <button
            key={a}
            type="button"
            title={`Align ${a}`}
            onClick={() => apply('align', a)}
            className={`p-1 rounded cursor-pointer text-[10px] px-1.5 ${
              align === a ? 'bg-[var(--accent)] text-[#1a1208]' : 'text-[var(--text-muted)]'
            }`}
          >
            {a === 'left' ? (
              <AlignLeft size={12} />
            ) : a === 'center' ? (
              <AlignCenter size={12} />
            ) : a === 'right' ? (
              <AlignRight size={12} />
            ) : (
              'J'
            )}
          </button>
        ))}
      </div>

      <OptSep />

      <ColorOpt label="Fill" value={fill} onChange={(v) => apply('fill', v)} />
      <ColorOpt
        label="Stroke"
        value={stroke}
        onChange={(v) => apply('stroke', v)}
        allowNone
        isNone={strokeWidth === 0}
        onNone={() => {
          apply('strokeWidth', 0);
          apply('stroke', 'transparent');
        }}
      />
      <NumOpt
        label="Wt"
        value={strokeWidth}
        min={0}
        max={12}
        unit="px"
        widthClass="w-9"
        onCommit={(v) => apply('strokeWidth', v)}
      />
      <NumOpt
        label="Track"
        value={letterSpacing}
        min={-20}
        max={40}
        widthClass="w-9"
        onCommit={(v) => apply('letterSpacing', v)}
      />
      {isText && (
        <>
          <OptSep />
          <OptHint>Warp</OptHint>
          <select
            value={selectedLayer.warpStyle || 'none'}
            onChange={(e) =>
              updateLayer(selectedLayer.id, {
                warpStyle: e.target.value as typeof selectedLayer.warpStyle,
              })
            }
            className="shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] max-w-[5.5rem]"
          >
            {(
              [
                'none',
                'arc',
                'arch',
                'bulge',
                'flag',
                'wave',
                'rise',
                'inflate',
                'squeeze',
                'twist',
              ] as const
            ).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          {(selectedLayer.warpStyle || 'none') !== 'none' && (
            <NumOpt
              label="Bend"
              value={selectedLayer.warpBend ?? 0}
              min={-100}
              max={100}
              widthClass="w-10"
              onCommit={(v) => updateLayer(selectedLayer.id, { warpBend: v })}
            />
          )}
        </>
      )}
    </div>
  );
};
