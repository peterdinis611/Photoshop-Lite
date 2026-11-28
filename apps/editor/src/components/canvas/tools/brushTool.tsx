import { Line } from 'react-konva';
import { paintStrokeOnMask, eraseStrokeOnImage } from '../../../utils/maskHelpers';
import { renderCursorRing } from './cursorRing';
import type { ToolHandler } from './types';

/** Soft-composite history pixels under a stroke path onto the current layer. */
async function paintHistoryStroke(opts: {
  currentSrc: string;
  historySrc: string;
  layerX: number;
  layerY: number;
  points: number[];
  size: number;
  opacity: number;
}): Promise<string> {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });

  const [current, history] = await Promise.all([
    load(opts.currentSrc),
    load(opts.historySrc),
  ]);
  const w = current.naturalWidth || current.width;
  const h = current.naturalHeight || current.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return opts.currentSrc;
  ctx.drawImage(current, 0, 0);

  const r = Math.max(4, Math.round(opts.size / 2));
  const step = Math.max(2, Math.floor(r / 2));
  for (let i = 0; i < opts.points.length - 1; i += step * 2) {
    const lx = Math.round(opts.points[i] - opts.layerX);
    const ly = Math.round(opts.points[i + 1] - opts.layerY);
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, opts.opacity));
    ctx.drawImage(history, 0, 0);
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
}

/** Brush, Eraser, Refine Brush and History Brush share one stroke pipeline. */
export const brushTool: ToolHandler = {
  id: ['brush', 'eraser', 'refineBrush', 'historyBrush'],

  onPointerDown: ({ point }, ctx) => {
    const { session, tool } = ctx;
    const { brushSettings } = ctx.getStore();
    const isEraser =
      tool === 'eraser' || (tool === 'refineBrush' && brushSettings.refineMode === 'erase');
    session.brushStroke = {
      points: [point.x, point.y],
      color: isEraser ? 'rgba(0,0,0,1)' : brushSettings.color,
      size: brushSettings.size,
      opacity: brushSettings.opacity,
      isEraser,
      hardness: brushSettings.hardness,
    };
    session.brushPreview = [point.x, point.y];
  },

  onPointerMove: ({ point }, ctx) => {
    const { session } = ctx;
    if (!session.brushStroke) return;
    const { brushSettings } = ctx.getStore();
    const pts = session.brushStroke.points;
    const spacingPx = Math.max(2, brushSettings.size * (brushSettings.spacing ?? 0.25));
    if (pts.length >= 2) {
      const lx = pts[pts.length - 2];
      const ly = pts[pts.length - 1];
      const dx = point.x - lx;
      const dy = point.y - ly;
      if (Math.hypot(dx, dy) < spacingPx) return;
    }
    const jitter = brushSettings.sizeJitter ?? 0;
    const opJitter = brushSettings.opacityJitter ?? 0;
    let size = brushSettings.size;
    let opacity = brushSettings.opacity;
    if (jitter > 0) size *= 1 + (Math.random() * 2 - 1) * jitter;
    if (opJitter > 0) opacity *= 1 + (Math.random() * 2 - 1) * opJitter;
    const newPoints = [...pts, point.x, point.y];
    session.brushStroke.points = newPoints;
    session.brushStroke.size = Math.max(1, size);
    session.brushStroke.opacity = Math.max(0.05, Math.min(1, opacity));
    session.brushPreview = newPoints;
  },

  onPointerUp: async (_e, ctx) => {
    const { session, tool } = ctx;
    const stroke = session.brushStroke;
    if (!stroke) return;
    session.brushStroke = null;
    session.brushPreview = null;
    ctx.requestRedraw();

    const store = ctx.getStore();
    const imageLayer = ctx.getSelectedImageLayer();

    // Refine brush → paint (or auto-create) layer mask
    if (tool === 'refineBrush' && imageLayer) {
      if (!imageLayer.hasLayerMask || !imageLayer.layerMaskSrc) {
        store.toggleLayerMask(imageLayer.id);
      }
      const masked = ctx.getStore().layers.find((l) => l.id === imageLayer.id);
      const maskSrc =
        masked?.type === 'image' && masked.hasLayerMask ? masked.layerMaskSrc : undefined;
      if (maskSrc) {
        store.commitHistory('Paint Layer Mask');
        const newMask = await paintStrokeOnMask({
          maskSrc,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          layerWidth: imageLayer.width,
          layerHeight: imageLayer.height,
          points: stroke.points,
          size: stroke.size,
          erase: stroke.isEraser,
        });
        store.paintLayerMask(imageLayer.id, newMask);
        return;
      }
    }

    // History Brush — stamp pixels from a chosen (or latest) undo snapshot
    if (tool === 'historyBrush' && imageLayer) {
      const past = store.past;
      const sourceId = store.historyBrushSourceId;
      const snap =
        (sourceId ? past.find((s) => s.id === sourceId) : null) ||
        (past.length ? past[past.length - 1] : null);
      const histLayer = snap?.layers.find((l) => l.id === imageLayer.id);
      if (!histLayer || histLayer.type !== 'image') {
        return;
      }
      store.commitHistory('History Brush');
      const painted = await paintHistoryStroke({
        currentSrc: imageLayer.src,
        historySrc: histLayer.src,
        layerX: imageLayer.x,
        layerY: imageLayer.y,
        points: stroke.points,
        size: stroke.size,
        opacity: stroke.opacity,
      });
      store.updateLayer(imageLayer.id, { src: painted });
      return;
    }

    // Eraser on selected image → punch transparent pixels
    if (tool === 'eraser' && imageLayer) {
      store.commitHistory('Erase');
      const newSrc = await eraseStrokeOnImage({
        src: imageLayer.src,
        layerX: imageLayer.x,
        layerY: imageLayer.y,
        layerWidth: imageLayer.width,
        layerHeight: imageLayer.height,
        points: stroke.points,
        size: stroke.size,
        hardness: stroke.hardness,
      });
      store.updateLayer(imageLayer.id, { src: newSrc });
      return;
    }

    const drawingLayer = ctx.getStore().layers.find((l) => l.type === 'drawing');
    store.addDrawingStroke(drawingLayer?.id || 'new', stroke);
  },

  renderOverlay: (ctx) => {
    const { session, tool } = ctx;
    const { brushSettings } = ctx.getStore();
    return (
      <>
        {session.brushPreview && (
          <Line
            points={session.brushPreview}
            stroke={
              tool === 'eraser' || (tool === 'refineBrush' && brushSettings.refineMode === 'erase')
                ? 'rgba(239, 68, 68, 0.7)'
                : brushSettings.color
            }
            strokeWidth={brushSettings.size}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            opacity={brushSettings.opacity}
            listening={false}
          />
        )}
        {renderCursorRing(ctx)}
      </>
    );
  },
};
