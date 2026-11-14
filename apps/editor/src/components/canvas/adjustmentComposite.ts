import type { AdjustmentLayer, EditorLayer, ImageAdjustments, ImageLayer } from '../../types/editor';

const NUMERIC_KEYS = [
  'brightness',
  'contrast',
  'saturation',
  'exposure',
  'sharpness',
  'blur',
  'vibrance',
  'temperature',
  'tint',
  'hue',
] as const satisfies readonly (keyof ImageAdjustments)[];

function mergeAdjustments(
  base: ImageAdjustments,
  adj: AdjustmentLayer
): ImageAdjustments {
  const amount = Math.max(0, Math.min(1, adj.opacity));
  const next: ImageAdjustments = { ...base };
  for (const key of NUMERIC_KEYS) {
    next[key] = base[key] + adj.adjustments[key] * amount;
  }
  if (amount >= 0.5) {
    if (adj.adjustments.invert) next.invert = !base.invert;
    if (adj.adjustments.grayscale) next.grayscale = true;
    if (adj.adjustments.sepia) next.sepia = true;
    if (adj.kind === 'curves' && adj.adjustments.curves) next.curves = adj.adjustments.curves;
    if (adj.kind === 'levels' && adj.adjustments.levels) next.levels = adj.adjustments.levels;
  }
  return next;
}

/**
 * Non-destructive preview of adjustment layers: every visible adjustment layer is folded
 * into the filter settings of the image layers beneath it (or only the layer it is clipped
 * to). Image layers without adjustments above them are returned untouched (same reference).
 */
export function applyAdjustmentLayers(layers: EditorLayer[]): EditorLayer[] {
  if (!layers.some((l) => l.type === 'adjustment' && l.visible)) return layers;

  return layers.map((layer, index) => {
    if (layer.type !== 'image') return layer;
    let adjustments: ImageAdjustments | null = null;
    for (let i = index + 1; i < layers.length; i++) {
      const candidate = layers[i];
      if (candidate.type !== 'adjustment' || !candidate.visible) continue;
      if (candidate.clippingMaskToId && candidate.clippingMaskToId !== layer.id) continue;
      adjustments = mergeAdjustments(adjustments ?? layer.adjustments, candidate);
    }
    return adjustments ? ({ ...layer, adjustments } as ImageLayer) : layer;
  });
}
