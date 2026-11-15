import { applyToneBrushToImage } from '@photoshop-lite/editor-core';
import type { ToneBrushMode } from '@photoshop-lite/editor-core';
import { dist } from '../../../utils/pathHelpers';
import { runLatest } from './async';
import { renderCursorRing } from './cursorRing';
import { averageScale, toImageLocal } from './geometry';
import type { Point, PointerStroke, ToolContext, ToolHandler } from './types';

const TONE_MODE: Record<string, ToneBrushMode> = {
  dodge: 'dodge',
  burn: 'burn',
  sharpenTool: 'sharpen',
};

const HISTORY_LABEL: Record<string, string> = {
  dodge: 'Dodge',
  burn: 'Burn',
  sharpenTool: 'Sharpen Brush',
};

function queueToneStamp(ctx: ToolContext, stroke: PointerStroke, mode: ToneBrushMode) {
  runLatest(ctx.session, async () => {
    const state = ctx.getStore();
    const layer = state.layers.find((l) => l.id === stroke.layerId);
    if (!layer || layer.type !== 'image') return;

    const from = stroke.last;
    const to = stroke.latest;
    stroke.last = to;

    const radius = Math.max(2, state.toneBrushSettings.size / 2 / averageScale(layer));
    const stamps: Point[] = [];
    // Fill the gap when the pointer outran the throttle
    if (dist(from.x, from.y, to.x, to.y) > radius * 0.8) {
      stamps.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    }
    stamps.push(to);

    let nextSrc = layer.src;
    for (const p of stamps) {
      const local = toImageLocal(layer, p.x, p.y);
      nextSrc = await applyToneBrushToImage(nextSrc, {
        cx: local.x,
        cy: local.y,
        radius,
        hardness: state.toneBrushSettings.hardness,
        opacity: state.brushSettings.opacity,
        exposure: state.toneBrushSettings.exposure,
        mode,
      });
    }
    state.updateLayer(layer.id, { src: nextSrc });
  });
}

/** Dodge / Burn / Sharpen brush — paints tone adjustments straight into the image layer. */
export const toneBrushTool: ToolHandler = {
  id: ['dodge', 'burn', 'sharpenTool'],

  onPointerDown: ({ point }, ctx) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    ctx.getStore().commitHistory(HISTORY_LABEL[ctx.tool]);
    const stroke = { layerId: imageLayer.id, last: point, latest: point };
    ctx.session.toneStroke = stroke;
    queueToneStamp(ctx, stroke, TONE_MODE[ctx.tool]);
  },

  onPointerMove: ({ point }, ctx) => {
    const stroke = ctx.session.toneStroke;
    if (!stroke) return;
    stroke.latest = point;
    const mode = TONE_MODE[ctx.tool];
    if (mode) queueToneStamp(ctx, stroke, mode);
  },

  onPointerUp: (_e, ctx) => {
    ctx.session.toneStroke = null;
  },

  renderOverlay: renderCursorRing,
};
