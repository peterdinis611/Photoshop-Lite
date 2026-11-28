import React from 'react';
import { Circle, Ellipse, Image as KonvaImage, Line, Rect } from 'react-konva';
import { useKonvaImage } from '@photoshop-lite/editor-konva';
import { magicWandBounds } from '../../../utils/maskHelpers';
import { dist } from '../../../utils/pathHelpers';
import { renderCursorRing } from './cursorRing';
import { pathBounds } from './geometry';
import { primeMagneticEdge, snapMagneticPoint } from './magneticEdgeCache';
import type { ToolContext, ToolHandler } from './types';

/** Closely spaced anchors are dropped while dragging the magnetic lasso (document px). */
const MAGNETIC_STEP = 8;

// ─── Marquee (rectangular / elliptical) ───────────────────────────────────────

export const marqueeTool: ToolHandler = {
  id: 'marquee',

  onPointerDown: ({ point }, ctx) => {
    const { session } = ctx;
    session.marqueeStart = { x: point.x, y: point.y };
    session.marqueePreview = { x: point.x, y: point.y, width: 0, height: 0 };
    ctx.getStore().setMarqueeSelection(null);
  },

  onPointerMove: ({ point }, { session }) => {
    const start = session.marqueeStart;
    if (!start) return;
    session.marqueePreview = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
  },

  onPointerUp: (_e, ctx) => {
    const { session } = ctx;
    const preview = session.marqueePreview;
    if (!session.marqueeStart || !preview) return;
    const { setMarqueeSelection, marqueeMode } = ctx.getStore();
    if (preview.width > 2 && preview.height > 2) {
      setMarqueeSelection({ ...preview, mode: marqueeMode });
    } else {
      setMarqueeSelection(null);
    }
    session.marqueeStart = null;
    session.marqueePreview = null;
  },
};

// ─── Freehand lasso ───────────────────────────────────────────────────────────

export const lassoTool: ToolHandler = {
  id: 'lasso',

  onPointerDown: ({ point }, ctx) => {
    ctx.session.lassoDrawing = true;
    ctx.session.lassoPreview = [point.x, point.y];
    ctx.getStore().setMarqueeSelection(null);
  },

  onPointerMove: ({ point }, { session }) => {
    const preview = session.lassoPreview;
    if (!session.lassoDrawing || !preview) return;
    const dx = point.x - preview[preview.length - 2];
    const dy = point.y - preview[preview.length - 1];
    if (dx * dx + dy * dy > 4) {
      session.lassoPreview = [...preview, point.x, point.y];
    }
  },

  onPointerUp: (_e, ctx) => {
    const { session } = ctx;
    const preview = session.lassoPreview;
    if (!session.lassoDrawing || !preview) return;
    session.lassoDrawing = false;
    if (preview.length >= 6) {
      ctx.getStore().setMarqueeSelection({
        ...pathBounds(preview),
        mode: 'rect',
        path: [...preview, preview[0], preview[1]],
      });
    }
    session.lassoPreview = null;
  },
};

// ─── Polygonal / magnetic lasso ───────────────────────────────────────────────

/** Close the polygonal / magnetic lasso draft into a path selection. */
export function commitPolygon(ctx: ToolContext) {
  const { session } = ctx;
  session.magneticDragging = false;
  const points = session.polyPoints;
  if (points.length < 6) {
    session.polyPoints = [];
    return;
  }
  ctx.getStore().setMarqueeSelection({
    ...pathBounds(points),
    mode: 'rect',
    path: [...points, points[0], points[1]],
  });
  session.polyPoints = [];
}

/** Click adds vertices; double-click, Enter or first-point click closes. */
export const polygonLassoTool: ToolHandler = {
  id: ['polyLasso', 'magneticLasso'],

  onPointerDown: ({ point, evt }, ctx) => {
    const { session } = ctx;
    const { zoom } = ctx.getView();
    const pts = session.polyPoints;

    if (evt.detail >= 2) {
      if (pts.length >= 6) commitPolygon(ctx);
      return;
    }
    if (pts.length >= 6 && dist(point.x, point.y, pts[0], pts[1]) <= 8 / zoom) {
      commitPolygon(ctx);
      return;
    }
    if (pts.length === 0) ctx.getStore().setMarqueeSelection(null);
    const lastX = pts[pts.length - 2];
    const lastY = pts[pts.length - 1];
    if (pts.length === 0 || lastX !== point.x || lastY !== point.y) {
      session.polyPoints = [...pts, point.x, point.y];
    }
    session.magneticDragging = ctx.tool === 'magneticLasso';
    // Start decoding the layer's edge map so dragging can snap to it
    if (session.magneticDragging) primeMagneticEdge(ctx);
  },

  onPointerMove: ({ point }, ctx) => {
    const { session } = ctx;
    if (!session.magneticDragging || ctx.tool !== 'magneticLasso') return;
    const prev = session.polyPoints;
    if (prev.length < 2) return;
    const lastX = prev[prev.length - 2];
    const lastY = prev[prev.length - 1];
    if (dist(point.x, point.y, lastX, lastY) < MAGNETIC_STEP) return;
    // Latch onto the nearest image edge; without edge data this is the raw 8px step
    const snapped = snapMagneticPoint(ctx, ctx.getSelectedImageLayer(), point);
    if (snapped.x === lastX && snapped.y === lastY) return;
    session.polyPoints = [...prev, snapped.x, snapped.y];
  },

  onPointerUp: (_e, { session }) => {
    session.magneticDragging = false;
  },

  onKeyDown: (e, ctx) => {
    const tag = (document.activeElement?.tagName ?? '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPolygon(ctx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ctx.session.magneticDragging = false;
      ctx.session.polyPoints = [];
      ctx.session.magneticEdge = null;
    }
  },

  onDeactivate: ({ session }) => {
    session.polyPoints = [];
    session.magneticDragging = false;
    session.magneticEdge = null;
  },

  renderOverlay: (ctx) => {
    const { session } = ctx;
    const pts = session.polyPoints;
    if (pts.length === 0) return null;
    const { zoom } = ctx.getView();
    const cursorPos = session.cursorPos;
    return (
      <>
        <Line
          points={cursorPos && !session.magneticDragging ? [...pts, cursorPos.x, cursorPos.y] : pts}
          stroke="#ece8e1"
          strokeWidth={1.25 / zoom}
          dash={[5 / zoom, 4 / zoom]}
          listening={false}
        />
        {Array.from({ length: pts.length / 2 }).map((_, i) => {
          const px = pts[i * 2];
          const py = pts[i * 2 + 1];
          const isFirst = i === 0;
          const nearFirst =
            isFirst &&
            pts.length >= 6 &&
            !!cursorPos &&
            dist(cursorPos.x, cursorPos.y, px, py) <= 8 / zoom;
          return (
            <Circle
              key={`poly-${i}`}
              x={px}
              y={py}
              radius={(isFirst ? (nearFirst ? 7 : 5) : 3) / zoom}
              fill={isFirst ? '#d4923a' : '#ece8e1'}
              stroke={nearFirst ? '#5ecf9a' : '#1a1208'}
              strokeWidth={(nearFirst ? 2 : 1) / zoom}
              listening={false}
            />
          );
        })}
      </>
    );
  },

  renderHud: ({ session }) =>
    session.polyPoints.length > 0 ? (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300">
        {session.polyPoints.length / 2} points —{' '}
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Enter</kbd> or
        double-click to close,{' '}
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Esc</kbd> to cancel
      </div>
    ) : null,
};

// ─── Quick select ─────────────────────────────────────────────────────────────

function applyQuickSelectBounds(ctx: ToolContext) {
  const b = ctx.session.quickSelect;
  if (!b) return;
  const { canvasWidth, canvasHeight } = ctx.getView();
  const x = Math.max(0, b.minX);
  const y = Math.max(0, b.minY);
  ctx.getStore().setMarqueeSelection({
    x,
    y,
    width: Math.max(1, Math.min(canvasWidth, b.maxX) - x),
    height: Math.max(1, Math.min(canvasHeight, b.maxY) - y),
    mode: 'rect',
  });
}

/** Painted area grows a rectangular selection (Shift adds to it). */
export const quickSelectTool: ToolHandler = {
  id: 'quickSelect',

  onPointerDown: ({ point, shiftKey }, ctx) => {
    const { brushSettings, marqueeSelection } = ctx.getStore();
    const r = brushSettings.size / 2;
    const base = shiftKey && marqueeSelection && !marqueeSelection.path ? marqueeSelection : null;
    ctx.session.quickSelect = base
      ? {
          minX: Math.min(base.x, point.x - r),
          minY: Math.min(base.y, point.y - r),
          maxX: Math.max(base.x + base.width, point.x + r),
          maxY: Math.max(base.y + base.height, point.y + r),
        }
      : { minX: point.x - r, minY: point.y - r, maxX: point.x + r, maxY: point.y + r };
    applyQuickSelectBounds(ctx);
  },

  onPointerMove: ({ point }, ctx) => {
    const b = ctx.session.quickSelect;
    if (!b) return;
    const r = ctx.getStore().brushSettings.size / 2;
    b.minX = Math.min(b.minX, point.x - r);
    b.minY = Math.min(b.minY, point.y - r);
    b.maxX = Math.max(b.maxX, point.x + r);
    b.maxY = Math.max(b.maxY, point.y + r);
    applyQuickSelectBounds(ctx);
  },

  onPointerUp: (_e, { session }) => {
    session.quickSelect = null;
  },

  renderOverlay: renderCursorRing,
};

// ─── Magic wand ───────────────────────────────────────────────────────────────

/** Select the similar-colour region under the click. */
export const wandTool: ToolHandler = {
  id: 'wand',

  onPointerDown: async ({ point }, ctx) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    const { wandTolerance, setMarqueeSelection } = ctx.getStore();
    const bounds = await magicWandBounds({
      src: imageLayer.src,
      layerX: imageLayer.x,
      layerY: imageLayer.y,
      layerWidth: imageLayer.width,
      layerHeight: imageLayer.height,
      clickX: point.x,
      clickY: point.y,
      tolerance: wandTolerance,
    });
    setMarqueeSelection(bounds ? { ...bounds, mode: 'rect' } : null);
  },
};

// ─── Shared overlay: drag preview + committed selection (shown for every tool) ───────

function SoftMaskOverlay({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) {
  const { image } = useKonvaImage(src);
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      opacity={0.42}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

export function renderSelectionOverlay(ctx: ToolContext): React.ReactNode {
  const { session } = ctx;
  const { zoom } = ctx.getView();
  const { marqueeSelection, marqueeMode, canvasWidth, canvasHeight } = ctx.getStore();
  const marqueePreview = session.marqueePreview;
  const lassoPreview = session.lassoPreview;

  const box = marqueePreview || (marqueeSelection && !marqueeSelection.path ? marqueeSelection : null);
  const isEllipse =
    (marqueeMode === 'ellipse' && marqueePreview) || marqueeSelection?.mode === 'ellipse';

  return (
    <>
      {marqueeSelection?.softMaskSrc && (
        <SoftMaskOverlay
          src={marqueeSelection.softMaskSrc}
          width={canvasWidth}
          height={canvasHeight}
        />
      )}
      {box &&
        (isEllipse ? (
          <Ellipse
            x={box.x + box.width / 2}
            y={box.y + box.height / 2}
            radiusX={Math.abs(box.width) / 2}
            radiusY={Math.abs(box.height) / 2}
            fill="rgba(212, 146, 58, 0.12)"
            stroke="#ece8e1"
            strokeWidth={1 / zoom}
            dash={[6 / zoom, 4 / zoom]}
            listening={false}
          />
        ) : (
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="rgba(212, 146, 58, 0.12)"
            stroke="#ece8e1"
            strokeWidth={1 / zoom}
            dash={[6 / zoom, 4 / zoom]}
            listening={false}
          />
        ))}

      {/* Lasso path preview / committed */}
      {(lassoPreview || marqueeSelection?.path) && (
        <Line
          points={lassoPreview || marqueeSelection!.path!}
          stroke="#ece8e1"
          strokeWidth={1.25 / zoom}
          dash={[5 / zoom, 4 / zoom]}
          closed={Boolean(marqueeSelection?.path && !lassoPreview)}
          fill={marqueeSelection?.path && !lassoPreview ? 'rgba(212, 146, 58, 0.1)' : undefined}
          listening={false}
        />
      )}
    </>
  );
}
