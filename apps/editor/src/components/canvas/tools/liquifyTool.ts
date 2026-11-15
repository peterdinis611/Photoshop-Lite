import { applyLiquifyBrush, clearLiquifySnapshotCache } from '@photoshop-lite/editor-core';
import { dist } from '../../../utils/pathHelpers';
import { runLatest } from './async';
import { renderCursorRing } from './cursorRing';
import { averageScale, toImageLocal, toImageLocalVector } from './geometry';
import type { LiquifyStroke, ToolContext, ToolHandler } from './types';

function queueLiquifyStamp(ctx: ToolContext, stroke: LiquifyStroke) {
  runLatest(ctx.session, async () => {
    const state = ctx.getStore();
    const layer = state.layers.find((l) => l.id === stroke.layerId);
    if (!layer || layer.type !== 'image') return;

    const from = stroke.last;
    const to = stroke.latest;
    if (dist(from.x, from.y, to.x, to.y) < 1) return;
    stroke.last = to;

    const { mode, strength } = state.liquifySettings;
    const radius = state.brushSettings.size / 2 / averageScale(layer);
    const localFrom = toImageLocal(layer, from.x, from.y);
    const localDelta = toImageLocalVector(layer, to.x - from.x, to.y - from.y);
    const reach = Math.hypot(localDelta.x, localDelta.y);

    const nextSrc = await applyLiquifyBrush(layer.src, {
      mode,
      // Push samples along the segment midpoint; twirl / reconstruct follow the pointer
      cx: mode === 'push' ? localFrom.x + localDelta.x / 2 : localFrom.x + localDelta.x,
      cy: mode === 'push' ? localFrom.y + localDelta.y / 2 : localFrom.y + localDelta.y,
      radius,
      dx: localDelta.x,
      dy: localDelta.y,
      // Longer drags spin further per stamp
      angle: Math.min(0.6, 0.12 + (reach / Math.max(radius, 1)) * 0.5),
      strength: Math.max(0.05, strength),
      originalSrc: stroke.originalSrc,
    });
    if (nextSrc !== layer.src) state.updateLayer(layer.id, { src: nextSrc });
  });
}

const MODE_LABEL = { push: 'Push', twirl: 'Twirl', reconstruct: 'Reconstruct' } as const;

/** Liquify — push / twirl / reconstruct brush on the selected image layer. */
export const liquifyTool: ToolHandler = {
  id: 'liquify',

  onPointerDown: ({ point }, ctx) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    ctx.getStore().commitHistory(`Liquify ${MODE_LABEL[ctx.getStore().liquifySettings.mode]}`);
    const { liquifyOriginals } = ctx.session;
    if (!liquifyOriginals.has(imageLayer.id)) liquifyOriginals.set(imageLayer.id, imageLayer.src);
    ctx.session.liquifyStroke = {
      layerId: imageLayer.id,
      last: point,
      latest: point,
      // Reconstruct restores toward the pixels from before liquifying began on this layer
      originalSrc: liquifyOriginals.get(imageLayer.id) ?? imageLayer.src,
    };
  },

  onPointerMove: ({ point }, ctx) => {
    const stroke = ctx.session.liquifyStroke;
    if (!stroke) return;
    stroke.latest = point;
    queueLiquifyStamp(ctx, stroke);
  },

  onPointerUp: (_e, ctx) => {
    ctx.session.liquifyStroke = null;
    clearLiquifySnapshotCache();
  },

  onDeactivate: ({ session }) => {
    session.liquifyStroke = null;
    session.liquifyOriginals.clear();
    clearLiquifySnapshotCache();
  },

  renderOverlay: renderCursorRing,
  cursor: () => 'cursor-move',
};
