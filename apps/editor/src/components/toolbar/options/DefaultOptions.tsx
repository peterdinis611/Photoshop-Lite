import React from 'react';
import { FlipHorizontal, FlipVertical, AlignCenter, Pause, Play, ImageDown } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, NumOpt, OptChip, OptHint, OptSep, SizeOpt } from '../../ui/OptionControls';
import { FontPicker } from '../../ui/FontPicker';
import { loadGoogleFont } from '../../../utils/googleFonts';
import { notify } from '../../../utils/notify';

interface DefaultOptionsProps {
  tool: 'select' | 'hand' | 'zoom' | 'eyedropper';
}

const MoveOptions: React.FC = () => {
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const bakeLottieLayer = useEditorStore((s) => s.bakeLottieLayer);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
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

  return (
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

          {selectedLayer.type === 'text' && (
            <>
              <OptSep />
              <FontPicker
                value={selectedLayer.fontFamily}
                onChange={async (family) => {
                  await loadGoogleFont(family);
                  updateLayer(selectedLayer.id, { fontFamily: family });
                }}
              />
              <NumOpt
                label="Size"
                value={selectedLayer.fontSize}
                min={8}
                max={400}
                unit="px"
                widthClass="w-12"
                onCommit={(fontSize) => updateLayer(selectedLayer.id, { fontSize })}
              />
            </>
          )}

          {selectedLayer.type === 'lottie' && (
            <>
              <OptSep />
              <div className="flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
                <button
                  type="button"
                  title={selectedLayer.playing ? 'Pause' : 'Play'}
                  className="p-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() =>
                    updateLayer(selectedLayer.id, { playing: !selectedLayer.playing })
                  }
                >
                  {selectedLayer.playing ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  title="Bake current frame to image layer"
                  className="p-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    void bakeLottieLayer(selectedLayer.id).then(() =>
                      notify.success('Frame baked', 'New image layer from Lottie')
                    );
                  }}
                >
                  <ImageDown size={13} />
                </button>
              </div>
              <OptChip
                active={selectedLayer.loop}
                onClick={() => updateLayer(selectedLayer.id, { loop: !selectedLayer.loop })}
              >
                Loop
              </OptChip>
              <SizeOpt
                label="Speed"
                value={selectedLayer.speed}
                min={0.1}
                max={3}
                step={0.1}
                onCommit={(speed) => updateLayer(selectedLayer.id, { speed })}
              />
            </>
          )}

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
  );
};

const ZoomOptions: React.FC = () => {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  return (
    <div className="flex items-center gap-3">
      <OptHint>
        Click zoom in · <kbd className="font-mono-ui text-[var(--accent-hot)]">Alt</kbd>+click out
      </OptHint>
      <span className="font-mono-ui text-[var(--text-primary)]">{Math.round(zoom * 100)}%</span>
      <OptChip onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>+</OptChip>
      <OptChip onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}>−</OptChip>
      <OptChip onClick={() => setZoom(1)}>100%</OptChip>
    </div>
  );
};

const EyedropperOptions: React.FC = () => {
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);
  return (
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
  );
};

/** Move (select), hand, zoom and eyedropper: hints + layer quick controls. */
export const DefaultOptions: React.FC<DefaultOptionsProps> = ({ tool }) => {
  switch (tool) {
    case 'select':
      return <MoveOptions />;
    case 'hand':
      return (
        <OptHint>
          Drag to pan · hold <kbd className="font-mono-ui text-[var(--accent-hot)]">Space</kbd> ·
          scroll zoom
        </OptHint>
      );
    case 'zoom':
      return <ZoomOptions />;
    case 'eyedropper':
      return <EyedropperOptions />;
  }
};
