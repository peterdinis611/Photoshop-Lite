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
  // Live preview only — not a pixel-accurate Gradient Map / Photo Filter bake.
  if (adj.kind === 'gradientMap') {
    const fold = Math.max(0, Math.min(1, amount));
    if (fold > 0.2) next.grayscale = true;
    if (fold > 0.35) next.sepia = true;
  }
  if (adj.kind === 'photoFilter') {
    const density = Math.max(0, Math.min(1, (adj.photoFilterDensity ?? 0.35) * amount));
    next.temperature = base.temperature + density * 42;
    next.tint = base.tint + density * 14;
    if (density > 0.25) next.sepia = true;
  }
  return next;
}

function adjustmentsEqual(a: ImageAdjustments, b: ImageAdjustments): boolean {
  for (const key of NUMERIC_KEYS) {
    if (a[key] !== b[key]) return false;
  }
  return (
    a.invert === b.invert &&
    a.grayscale === b.grayscale &&
    a.sepia === b.sepia &&
    a.curves === b.curves &&
    a.levels === b.levels
  );
}

/** Last emitted image layer per id — keep stable refs when folded adj unchanged. */
const lastEmitted = new Map<string, ImageLayer>();

/**
 * Non-destructive preview of adjustment layers: every visible adjustment layer is folded
 * into the filter settings of the image layers beneath it (or only the layer it is clipped
 * to). Image layers without adjustments above them are returned untouched (same reference).
 */
export function applyAdjustmentLayers(layers: EditorLayer[]): EditorLayer[] {
  if (!layers.some((l) => l.type === 'adjustment' && l.visible)) {
    lastEmitted.clear();
    return layers;
  }

  const seen = new Set<string>();
  const out = layers.map((layer, index) => {
    if (layer.type !== 'image') return layer;
    seen.add(layer.id);
    let adjustments: ImageAdjustments | null = null;
    for (let i = index + 1; i < layers.length; i++) {
      const candidate = layers[i];
      if (candidate.type !== 'adjustment' || !candidate.visible) continue;
      if (candidate.clippingMaskToId && candidate.clippingMaskToId !== layer.id) continue;
      adjustments = mergeAdjustments(adjustments ?? layer.adjustments, candidate);
    }
    if (!adjustments) {
      lastEmitted.delete(layer.id);
      return layer;
    }
    const prev = lastEmitted.get(layer.id);
    if (
      prev &&
      prev.src === layer.src &&
      prev.x === layer.x &&
      prev.y === layer.y &&
      prev.width === layer.width &&
      prev.height === layer.height &&
      prev.scaleX === layer.scaleX &&
      prev.scaleY === layer.scaleY &&
      prev.rotation === layer.rotation &&
      prev.opacity === layer.opacity &&
      prev.blendMode === layer.blendMode &&
      prev.visible === layer.visible &&
      prev.locked === layer.locked &&
      prev.hasLayerMask === layer.hasLayerMask &&
      prev.layerMaskSrc === layer.layerMaskSrc &&
      prev.clippingMaskToId === layer.clippingMaskToId &&
      prev.styles === layer.styles &&
      adjustmentsEqual(prev.adjustments, adjustments)
    ) {
      return prev;
    }
    const merged = { ...layer, adjustments } as ImageLayer;
    lastEmitted.set(layer.id, merged);
    return merged;
  });

  for (const id of lastEmitted.keys()) {
    if (!seen.has(id)) lastEmitted.delete(id);
  }
  return out;
}
