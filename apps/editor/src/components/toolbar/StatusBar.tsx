import React from 'react';
import { Layers, MousePointer2, Ruler } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

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

  const selected = layers.find((l) => l.id === selectedLayerId);
  const visibleCount = layers.filter((l) => l.visible).length;

  return (
    <footer className="shell-status status-bar" data-testid="editor-status-bar">
      <div className="status-bar-group">
        <span className="status-pill">
          <Ruler size={11} />
          {canvasWidth} × {canvasHeight}
        </span>
        <span className="status-pill status-pill--mono">{Math.round(zoom * 100)}%</span>
        <span className="status-pill">
          <Layers size={11} />
          {visibleCount}/{layers.length} layers
        </span>
      </div>

      <div className="status-bar-center">
        <MousePointer2 size={11} className="text-[var(--accent)] shrink-0" />
        <span className="truncate">
          {selected
            ? `${selected.name} · ${selected.type}${selected.locked ? ' · locked' : ''}`
            : layers.length === 0
              ? 'Empty document — drop or browse an image'
              : TOOL_HINT[activeTool] ?? activeTool}
        </span>
      </div>

      <div className="status-bar-group status-bar-group--end">
        {showRulers && <span className="status-chip">Rulers</span>}
        {showGrid && <span className="status-chip">Grid</span>}
        <span className="status-chip status-chip--accent">{activeTool}</span>
      </div>
    </footer>
  );
};
