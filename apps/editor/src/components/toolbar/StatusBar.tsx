import React from 'react';
import { Frame, Layers, MousePointer2, Ruler } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { LiveRegion } from '../../a11y/LiveRegion';

const TOOL_HINT: Record<string, string> = {
  select: 'Drag to move · Shift-constrain',
  marquee: 'Drag to select · Esc to clear',
  crop: 'Drag handles · Enter apply · Esc cancel',
  brush: 'Paint · [ ] size · X swap colors',
  eraser: 'Erase pixels on image · strokes on drawings',
  refineBrush: 'Paint mask edges · auto-adds mask if needed',
  spotHealing: 'Click/drag blemishes to heal',
  clone: 'Alt-click source · drag to clone',
  eyedropper: 'Sample color into brush',
  fill: 'Click to flood-fill',
  blur: 'Paint soft blur',
  text: 'Click canvas to place type',
  shape: 'Drag to draw · click to drop',
  pen: 'Click anchors · drag curves · click first to close · Enter finish · Esc cancel',
  hand: 'Drag to pan the stage',
  zoom: 'Click zoom in · Alt zoom out',
  liquify: 'Drag on an image layer to push pixels · Size in options bar',
};

export const StatusBar: React.FC = () => {
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showRulers = useEditorStore((s) => s.showRulers);
  const artboards = useEditorStore((s) => s.artboards);
  const activeArtboardId = useEditorStore((s) => s.activeArtboardId);
  const activeArtboard = artboards.find((a) => a.id === activeArtboardId);

  const selected = layers.find((l) => l.id === selectedLayerId);
  const visibleCount = layers.filter((l) => l.visible).length;

  const centerText = selected
    ? `${selected.name} · ${selected.type}${selected.locked ? ' · locked' : ''}`
    : layers.length === 0
      ? 'Empty document — drop or browse an image'
      : TOOL_HINT[activeTool] ?? activeTool;

  const announcement = selected
    ? `Selected ${selected.name}, ${selected.type}${selected.locked ? ', locked' : ''}. Tool: ${activeTool}. ${canvasWidth} by ${canvasHeight} at ${Math.round(zoom * 100)} percent. ${visibleCount} of ${layers.length} layers visible.`
    : layers.length === 0
      ? `Empty document. Tool: ${activeTool}. ${canvasWidth} by ${canvasHeight}.`
      : `Tool: ${activeTool}. Hint: ${TOOL_HINT[activeTool] ?? activeTool}. ${visibleCount} of ${layers.length} layers visible.`;

  return (
    <footer
      id="editor-status"
      className="shell-status status-bar"
      data-testid="editor-status-bar"
      aria-label="Editor status"
      tabIndex={-1}
    >
      <LiveRegion message={announcement} />

      <div className="status-bar-group">
        <span className="status-pill">
          <Ruler size={11} aria-hidden />
          <span aria-label={`Document size ${canvasWidth} by ${canvasHeight}`}>
            {canvasWidth} × {canvasHeight}
          </span>
        </span>
        <span className="status-pill status-pill--mono" aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>
          {Math.round(zoom * 100)}%
        </span>
        <span className="status-pill">
          <Layers size={11} aria-hidden />
          {visibleCount}/{layers.length} layers
        </span>
        {artboards.length > 0 && (
          <span className="status-pill" data-testid="status-artboard">
            <Frame size={11} aria-hidden />
            {activeArtboard ? activeArtboard.name : `${artboards.length} artboards`}
          </span>
        )}
      </div>

      <div className="status-bar-center" aria-hidden="true">
        <MousePointer2 size={11} className="text-[var(--accent)] shrink-0" />
        <span className="truncate">{centerText}</span>
      </div>

      <div className="status-bar-group status-bar-group--end">
        {showRulers && <span className="status-chip">Rulers</span>}
        {showGrid && <span className="status-chip">Grid</span>}
        <span className="status-chip status-chip--accent" aria-label={`Active tool ${activeTool}`}>
          {activeTool}
        </span>
      </div>
    </footer>
  );
};
