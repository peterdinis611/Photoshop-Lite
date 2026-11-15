import { Circle, Line } from 'react-konva';
import {
  mapUnitToQuad,
  warpImagePerspectiveDetailed,
  type Quad,
  type WarpMethod,
} from '@photoshop-lite/editor-core';
import type { EditorLayer, ImageLayer, ToolType, TransformMode } from '../../../types/editor';
import { toDocument, toImageLocal } from './geometry';
import type { Point, ToolContext, ToolHandler } from './types';

export type TransformerConfig = {
  transformToolActive: boolean;
  /** Skew / warp can only be approximated by Konva's Transformer. */
  freeTransformMode: boolean;
  /** Perspective / distort use 4 draggable corner handles instead of the Transformer. */
  cornerWarpMode: boolean;
  anchors: string[] | undefined;
  rotateEnabled: boolean;
};

const CORNER_WARP_MODES: TransformMode[] = ['perspective', 'distort'];

/** Transformer behaviour for the active tool, selected layer and transform mode. */
export function getTransformerConfig(
  activeTool: ToolType,
  transformMode: TransformMode,
  selectedLayer: EditorLayer | undefined
): TransformerConfig {
  const transformToolActive = activeTool === 'transform';
  const cornerWarpMode =
    transformToolActive && selectedLayer?.type === 'image' && CORNER_WARP_MODES.includes(transformMode);
  // Non-image layers have no pixels to bake, so perspective / distort stay approximated
  const freeTransformMode =
    transformToolActive &&
    (['skew', 'warp'].includes(transformMode) ||
      (CORNER_WARP_MODES.includes(transformMode) && !cornerWarpMode));
  const isLineLikeShape =
    selectedLayer?.type === 'shape' && ['line', 'arrow'].includes(selectedLayer.shapeType);
  const anchors: string[] | undefined = isLineLikeShape
    ? ['middle-left', 'middle-right', 'top-center', 'bottom-center']
    : transformToolActive && transformMode === 'rotate'
      ? []
      : transformToolActive && transformMode === 'scale'
        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        : undefined;
  return {
    transformToolActive,
    freeTransformMode,
    cornerWarpMode,
    anchors,
    rotateEnabled: !(transformToolActive && transformMode === 'scale'),
  };
}

// ─── Perspective / distort corner handles ─────────────────────────────────────

const WARP_AMBER = '#d4923a';
const WARP_BONE = '#ece8e1';
const WARP_ALERT = '#e85d5d';
const GRID_STEPS = 12;

function warpModeActive(ctx: ToolContext): ImageLayer | null {
  const { transformMode } = ctx.getStore();
  if (!CORNER_WARP_MODES.includes(transformMode)) return null;
  const layer = ctx.getSelectedImageLayer();
  return layer && layer.visible && !layer.locked ? layer : null;
}

/** Corner quad for the layer (document space), created lazily and reset when the layer changes. */
function ensureWarpCorners(ctx: ToolContext, layer: ImageLayer): Point[] {
  const { session } = ctx;
  const { transformMode } = ctx.getStore();
  const key = [
    layer.id,
    layer.x,
    layer.y,
    layer.rotation,
    layer.scaleX,
    layer.scaleY,
    layer.width,
    layer.height,
    layer.src.length,
    transformMode,
  ].join('|');
  if (session.warpCorners?.key !== key) {
    session.warpCorners = {
      layerId: layer.id,
      key,
      points: [
        toDocument(layer, 0, 0),
        toDocument(layer, layer.width, 0),
        toDocument(layer, layer.width, layer.height),
        toDocument(layer, 0, layer.height),
      ],
    };
  }
  return session.warpCorners.points;
}

/** Convex quads only: a bow-tie would fold the image over itself. */
function isConvexQuad(pts: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Point at unit-square coordinates (u, v) of the quad for the current warp method. */
function quadPoint(pts: Point[], u: number, v: number, method: WarpMethod): Point {
  if (method === 'projective') return mapUnitToQuad(pts as Quad, u, v);
  const [a, b, c, d] = pts;
  return {
    x: (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x,
    y: (1 - u) * (1 - v) * a.y + u * (1 - v) * b.y + u * v * c.y + (1 - u) * v * d.y,
  };
}

const methodFor = (mode: TransformMode): WarpMethod =>
  mode === 'distort' ? 'bilinear' : 'projective';

/** Bake the dragged quad into the layer pixels and reset the handles. */
export async function commitWarp(ctx: ToolContext): Promise<void> {
  const { session } = ctx;
  const layer = warpModeActive(ctx);
  const corners = session.warpCorners;
  if (!layer || !corners || corners.layerId !== layer.id || session.warpBusy) return;
  if (!isConvexQuad(corners.points)) return;

  const state = ctx.getStore();
  const method = methodFor(state.transformMode);
  const local = corners.points.map((p) => toImageLocal(layer, p.x, p.y));

  session.warpBusy = true;
  ctx.requestRedraw();
  try {
    const warped = await warpImagePerspectiveDetailed(layer.src, local, { method });
    if (!warped) return;

    const updates: Partial<ImageLayer> = {
      src: warped.src,
      width: warped.width,
      height: warped.height,
    };
    // A layer mask must follow the same warp or it would no longer line up
    if (layer.hasLayerMask && layer.layerMaskSrc) {
      const mask = await warpImagePerspectiveDetailed(layer.layerMaskSrc, local, { method });
      if (mask) updates.layerMaskSrc = mask.src;
    }
    const origin = toDocument(layer, warped.offsetX, warped.offsetY);
    updates.x = Math.round(origin.x);
    updates.y = Math.round(origin.y);

    state.commitHistory(`${method === 'bilinear' ? 'Distort' : 'Perspective'} warp`);
    state.updateLayer(layer.id, updates);
    session.warpCorners = null;
  } catch (err) {
    console.error('Perspective warp failed:', err);
  } finally {
    session.warpBusy = false;
    ctx.requestRedraw();
  }
}

/**
 * The Transformer itself lives in CanvasStage (it needs the selected Konva node); this handler
 * only owns the transform tool's hint and cursor.
 */
export const transformTool: ToolHandler = {
  id: 'transform',

  cursor: () => 'cursor-default',

  onPointerDown: ({ evt }, ctx) => {
    // Double-click anywhere on the stage bakes the corner warp
    if (evt.detail >= 2 && warpModeActive(ctx)) {
      void commitWarp(ctx);
      return;
    }
    // Pass through so a click on the empty canvas still deselects
    return false;
  },

  onKeyDown: (e, ctx) => {
    if (!warpModeActive(ctx)) return;
    const tag = (document.activeElement?.tagName ?? '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitWarp(ctx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ctx.session.warpCorners = null;
    }
  },

  onDeactivate: ({ session }) => {
    session.warpCorners = null;
  },

  renderUi: (ctx) => {
    const layer = warpModeActive(ctx);
    if (!layer) return null;
    const { zoom } = ctx.getView();
    const { session } = ctx;
    const { transformMode } = ctx.getStore();
    const method = methodFor(transformMode);
    const pts = ensureWarpCorners(ctx, layer);
    const valid = isConvexQuad(pts);
    const accent = valid ? WARP_AMBER : WARP_ALERT;

    // Inner mesh lines (thirds) show how the image will bend
    const mesh: number[][] = [];
    for (const t of [1 / 3, 2 / 3]) {
      const row: number[] = [];
      const col: number[] = [];
      for (let i = 0; i <= GRID_STEPS; i++) {
        const s = i / GRID_STEPS;
        const a = quadPoint(pts, s, t, method);
        const b = quadPoint(pts, t, s, method);
        row.push(a.x, a.y);
        col.push(b.x, b.y);
      }
      mesh.push(row, col);
    }

    return (
      <>
        <Line
          points={pts.flatMap((p) => [p.x, p.y])}
          closed
          fill="rgba(212, 146, 58, 0.08)"
          stroke={accent}
          strokeWidth={1.5 / zoom}
          listening={false}
        />
        {mesh.map((line, i) => (
          <Line
            key={`warp-mesh-${i}`}
            points={line}
            stroke={accent}
            strokeWidth={1 / zoom}
            dash={[4 / zoom, 4 / zoom]}
            opacity={0.55}
            listening={false}
          />
        ))}
        {pts.map((p, i) => (
          <Circle
            key={`warp-corner-${i}`}
            x={p.x}
            y={p.y}
            radius={6 / zoom}
            fill={WARP_BONE}
            stroke={accent}
            strokeWidth={2 / zoom}
            hitStrokeWidth={10 / zoom}
            draggable={!session.warpBusy}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'move';
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = '';
            }}
            onDragMove={(e) => {
              const corners = session.warpCorners;
              if (!corners) return;
              corners.points[i] = { x: e.target.x(), y: e.target.y() };
              ctx.requestRedraw();
            }}
          />
        ))}
      </>
    );
  },

  renderHud: (ctx) => {
    const { selectedLayerId, transformMode, layers } = ctx.getStore();
    const selected = layers.find((l) => l.id === selectedLayerId);
    const { freeTransformMode, cornerWarpMode } = getTransformerConfig(
      'transform',
      transformMode,
      selected
    );
    const hudClass =
      'absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300';
    const kbdClass = 'bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono';

    if (cornerWarpMode) {
      const corners = ctx.session.warpCorners;
      const invalid = corners ? !isConvexQuad(corners.points) : false;
      return (
        <div className={hudClass}>
          {ctx.session.warpBusy ? (
            'Baking warp…'
          ) : invalid ? (
            <span className="text-[#e85d5d]">Corners cross over — keep the quad convex to apply.</span>
          ) : (
            <>
              Drag the corner handles — <kbd className={kbdClass}>Enter</kbd> or double-click to
              apply, <kbd className={kbdClass}>Esc</kbd> to reset
            </>
          )}
        </div>
      );
    }

    if (!selectedLayerId || !freeTransformMode) return null;
    return (
      <div className={hudClass}>
        {transformMode.charAt(0).toUpperCase() + transformMode.slice(1)} is approximated: drag any
        handle to stretch the layer unevenly, rotate with the top handle.
      </div>
    );
  },
};
