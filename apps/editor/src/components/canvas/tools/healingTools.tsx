import { Line } from 'react-konva';
import { applyHealingBrushToImage, applyPatchToImage } from '@photoshop-lite/editor-core';
import { applyCloneStampToImage, applySpotHealingToImage } from '../../../utils/retouchHelpers';
import { dist } from '../../../utils/pathHelpers';
import { runThrottled } from './async';
import { renderCursorRing } from './cursorRing';
import { averageScale, pathBounds, selectionToPolygon, toImageLocal } from './geometry';
import type { HealStroke, Point, ToolContext, ToolHandler } from './types';

const HUD_BASE =
  'absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] rounded-lg shadow-xl z-40 text-xs text-zinc-300';
const KBD = 'bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono';

// ─── Spot healing ─────────────────────────────────────────────────────────────

function makeSpotHeal(ctx: ToolContext) {
  return async (coords: Point) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    const { brushSettings: brush, layers, updateLayer } = ctx.getStore();
    const fresh = layers.find((l) => l.id === imageLayer.id);
    if (!fresh || fresh.type !== 'image') return;
    const newSrc = await applySpotHealingToImage(
      fresh.src,
      fresh.x,
      fresh.y,
      coords.x,
      coords.y,
      brush.size / 2
    );
    updateLayer(fresh.id, { src: newSrc });
  };
}

const spotHeal = (ctx: ToolContext, coords: Point) =>
  runThrottled(ctx.session, 'spotHealing', 60, makeSpotHeal(ctx), coords);

/** Click / drag to heal blemishes automatically. */
export const spotHealingTool: ToolHandler = {
  id: 'spotHealing',

  onPointerDown: ({ point }, ctx) => {
    if (!ctx.getSelectedImageLayer()) return;
    ctx.session.spotHealing = true;
    spotHeal(ctx, point);
  },

  onPointerMove: ({ point }, ctx) => {
    if (ctx.session.spotHealing) spotHeal(ctx, point);
  },

  onPointerUp: (_e, { session }) => {
    session.spotHealing = false;
  },

  renderOverlay: renderCursorRing,

  renderHud: ({ session }) =>
    session.spotHealing ? (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-900/80 backdrop-blur-md border border-orange-500/40 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-orange-200">
        <span className="animate-spin">⟳</span> Healing...
      </div>
    ) : null,
};

// ─── Clone stamp ──────────────────────────────────────────────────────────────

function makeCloneStamp(ctx: ToolContext) {
  return async (coords: Point) => {
    const { session } = ctx;
    const imageLayer = ctx.getSelectedImageLayer();
    const offset = session.cloneOffset;
    if (!imageLayer || !offset) return;
    const { brushSettings: brush, layers, updateLayer } = ctx.getStore();
    const fresh = layers.find((l) => l.id === imageLayer.id);
    if (!fresh || fresh.type !== 'image') return;
    const srcX = coords.x - offset.x;
    const srcY = coords.y - offset.y;
    const newSrc = await applyCloneStampToImage(
      fresh.src,
      fresh.x,
      fresh.y,
      srcX,
      srcY,
      coords.x,
      coords.y,
      brush.size / 2,
      brush.opacity
    );
    updateLayer(fresh.id, { src: newSrc });
    session.cloneSource = { x: srcX, y: srcY };
    ctx.requestRedraw();
  };
}

const cloneStamp = (ctx: ToolContext, coords: Point) =>
  runThrottled(ctx.session, 'clone', 50, makeCloneStamp(ctx), coords);

/** Alt+click sets the source, then drag to paint. */
export const cloneStampTool: ToolHandler = {
  id: 'clone',

  onPointerDown: ({ point, altKey }, ctx) => {
    const { session } = ctx;
    if (altKey) {
      session.cloneSource = { x: point.x, y: point.y };
      ctx.getStore().updateBrushSettings({ cloneSource: { x: point.x, y: point.y } });
      return;
    }
    if (session.cloneSource && ctx.getSelectedImageLayer()) {
      session.cloneOffset = {
        x: point.x - session.cloneSource.x,
        y: point.y - session.cloneSource.y,
      };
      session.cloning = true;
      cloneStamp(ctx, point);
    }
  },

  onPointerMove: ({ point }, ctx) => {
    if (ctx.session.cloning) cloneStamp(ctx, point);
  },

  onPointerUp: (_e, { session }) => {
    if (session.cloning) {
      session.cloning = false;
      session.cloneOffset = null;
    }
  },

  renderOverlay: (ctx) => {
    const source = ctx.session.cloneSource;
    const { zoom } = ctx.getView();
    return (
      <>
        {renderCursorRing(ctx)}
        {source && (
          <>
            <Line
              points={[source.x - 12, source.y, source.x + 12, source.y]}
              stroke="#facc15"
              strokeWidth={1.5 / zoom}
              listening={false}
            />
            <Line
              points={[source.x, source.y - 12, source.x, source.y + 12]}
              stroke="#facc15"
              strokeWidth={1.5 / zoom}
              listening={false}
            />
          </>
        )}
      </>
    );
  },

  renderHud: ({ session }) => {
    const source = session.cloneSource;
    return (
      <div className={`${HUD_BASE} px-3 py-1.5 flex items-center gap-2`}>
        {source ? (
          <>
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            Source set at ({source.x}, {source.y}) — Click to stamp.{' '}
            <kbd className={KBD}>Alt+Click</kbd> to change source.
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
            <kbd className={KBD}>Alt+Click</kbd> on the canvas to set a clone source point.
          </>
        )}
      </div>
    );
  },

  cursor: ({ session }) => (session.cloneSource ? 'cursor-crosshair' : 'cursor-copy'),
};

// ─── Healing brush ────────────────────────────────────────────────────────────

/** Points accumulate while dragging and are applied once on pointer-up. */
async function applyHealingStroke(ctx: ToolContext, stroke: HealStroke) {
  const state = ctx.getStore();
  const layer = state.layers.find((l) => l.id === stroke.layerId);
  if (!layer || layer.type !== 'image' || stroke.points.length < 2) return;

  const points: number[] = [];
  for (let i = 0; i < stroke.points.length; i += 2) {
    const p = toImageLocal(layer, stroke.points[i], stroke.points[i + 1]);
    points.push(p.x, p.y);
  }
  const srcLocal = toImageLocal(layer, stroke.source.x, stroke.source.y);

  state.commitHistory('Healing Brush');
  const newSrc = await applyHealingBrushToImage(layer.src, {
    points,
    size: state.brushSettings.size / averageScale(layer),
    hardness: state.brushSettings.hardness,
    sourceOffsetX: srcLocal.x - points[0],
    sourceOffsetY: srcLocal.y - points[1],
  });
  state.updateLayer(layer.id, { src: newSrc });
}

/** Alt+click sets the source, drag paints, applied once on pointer-up. */
export const healingBrushTool: ToolHandler = {
  id: 'healing',

  onPointerDown: ({ point, altKey }, ctx) => {
    const { brushSettings, updateBrushSettings } = ctx.getStore();
    if (altKey) {
      updateBrushSettings({ cloneSource: { x: point.x, y: point.y } });
      return;
    }
    const imageLayer = ctx.getSelectedImageLayer();
    const source = brushSettings.cloneSource;
    if (!imageLayer || !source) return;
    ctx.session.healStroke = {
      layerId: imageLayer.id,
      points: [point.x, point.y],
      source: { x: source.x, y: source.y },
    };
    ctx.session.healPreview = [point.x, point.y];
  },

  onPointerMove: ({ point }, { session }) => {
    const stroke = session.healStroke;
    if (!stroke) return;
    const pts = stroke.points;
    if (dist(point.x, point.y, pts[pts.length - 2], pts[pts.length - 1]) >= 2) {
      pts.push(point.x, point.y);
      session.healPreview = [...pts];
    }
  },

  onPointerUp: async (_e, ctx) => {
    const stroke = ctx.session.healStroke;
    if (!stroke) return;
    ctx.session.healStroke = null;
    ctx.session.healPreview = null;
    ctx.requestRedraw();
    await applyHealingStroke(ctx, stroke);
  },

  renderOverlay: (ctx) => {
    const { brushSettings } = ctx.getStore();
    const { zoom } = ctx.getView();
    const preview = ctx.session.healPreview;
    const src = brushSettings.cloneSource;
    return (
      <>
        {preview && (
          <Line
            points={preview}
            stroke="#5ecf9a"
            strokeWidth={brushSettings.size}
            lineCap="round"
            lineJoin="round"
            opacity={0.22}
            listening={false}
          />
        )}
        {src && (
          <>
            <Line
              points={[src.x - 12, src.y, src.x + 12, src.y]}
              stroke="#5ecf9a"
              strokeWidth={1.5 / zoom}
              listening={false}
            />
            <Line
              points={[src.x, src.y - 12, src.x, src.y + 12]}
              stroke="#5ecf9a"
              strokeWidth={1.5 / zoom}
              listening={false}
            />
          </>
        )}
        {renderCursorRing(ctx)}
      </>
    );
  },

  renderHud: (ctx) =>
    ctx.getStore().brushSettings.cloneSource ? null : (
      <div className={`${HUD_BASE} px-3 py-1.5 flex items-center gap-2`}>
        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
        <kbd className={KBD}>Alt+Click</kbd> to set a healing source point.
      </div>
    ),

  cursor: (ctx) => (ctx.getStore().brushSettings.cloneSource ? 'cursor-crosshair' : 'cursor-copy'),
};

// ─── Patch ────────────────────────────────────────────────────────────────────

/** Copy the selected region (source) so it is centred on the clicked destination. */
async function applyPatchAt(ctx: ToolContext, dest: Point) {
  const state = ctx.getStore();
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  const selection = state.marqueeSelection;
  if (!layer || layer.type !== 'image' || !selection) return;

  const polygon = selectionToPolygon(selection);
  const fromPath: number[] = [];
  for (let i = 0; i < polygon.length; i += 2) {
    const p = toImageLocal(layer, polygon[i], polygon[i + 1]);
    fromPath.push(p.x, p.y);
  }
  const to = toImageLocal(layer, dest.x, dest.y);

  state.commitHistory('Patch');
  const newSrc = await applyPatchToImage(layer.src, {
    fromPath,
    toX: to.x,
    toY: to.y,
    feather: 2,
  });
  state.updateLayer(layer.id, { src: newSrc });
}

/** Drag outlines the source region, a click then drops it at the destination. */
export const patchTool: ToolHandler = {
  id: 'patch',

  onPointerDown: ({ point }, ctx) => {
    if (!ctx.getSelectedImageLayer()) return;
    ctx.session.patchDrawing = true;
    ctx.session.patchPreview = [point.x, point.y];
  },

  onPointerMove: ({ point }, { session }) => {
    const prev = session.patchPreview;
    if (!session.patchDrawing || !prev) return;
    const dx = point.x - prev[prev.length - 2];
    const dy = point.y - prev[prev.length - 1];
    if (dx * dx + dy * dy > 4) session.patchPreview = [...prev, point.x, point.y];
  },

  onPointerUp: async (_e, ctx) => {
    const { session } = ctx;
    if (!session.patchDrawing) return;
    session.patchDrawing = false;
    const outline = session.patchPreview;
    session.patchPreview = null;
    ctx.requestRedraw();
    const store = ctx.getStore();
    if (outline && outline.length >= 6) {
      store.setMarqueeSelection({
        ...pathBounds(outline),
        mode: 'rect',
        path: [...outline, outline[0], outline[1]],
      });
    } else if (outline && store.marqueeSelection) {
      await applyPatchAt(ctx, { x: outline[0], y: outline[1] });
    }
  },

  onDeactivate: ({ session }) => {
    session.patchDrawing = false;
    session.patchPreview = null;
  },

  renderOverlay: (ctx) => {
    const preview = ctx.session.patchPreview;
    if (!preview || preview.length < 4) return null;
    const { zoom } = ctx.getView();
    return (
      <Line
        points={preview}
        stroke="#5b8def"
        strokeWidth={1.25 / zoom}
        dash={[5 / zoom, 4 / zoom]}
        closed
        fill="rgba(91, 141, 239, 0.12)"
        listening={false}
      />
    );
  },

  renderHud: (ctx) => (
    <div className={`${HUD_BASE} px-3 py-1.5`}>
      {ctx.getStore().marqueeSelection
        ? 'Click to patch the selected region onto that spot — drag to outline a new source.'
        : 'Drag to outline the source region, then click the destination.'}
    </div>
  ),
};
