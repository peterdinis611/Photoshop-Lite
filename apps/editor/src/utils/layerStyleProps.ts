import type { LayerStyles } from '../types/editor';

/**
 * Map LayerStyles → primary Konva shadow props.
 * Priority when multiple FX are active: outer glow > drop shadow.
 * Inner / bevel / satin are returned as secondary overlays for callers that can stack.
 */
export function layerShadowProps(styles: LayerStyles | undefined) {
  const s = styles || {};
  const useGlow = (s.outerGlowBlur || 0) > 0;

  if (useGlow) {
    return {
      shadowColor: s.outerGlowColor || '#e8a84a',
      shadowBlur: s.outerGlowBlur || 0,
      shadowOffset: { x: 0, y: 0 },
      shadowOpacity: 0.85,
    };
  }

  // Drop shadow is the default Konva shadow channel
  if ((s.shadowBlur || 0) > 0 || (s.shadowOpacity || 0) > 0) {
    return {
      shadowColor: s.shadowColor || '#000000',
      shadowBlur: s.shadowBlur || 0,
      shadowOffset: {
        x: s.shadowOffsetX || 0,
        y: s.shadowOffsetY || 0,
      },
      shadowOpacity: s.shadowOpacity || 0,
    };
  }

  if ((s.innerShadowBlur || 0) > 0) {
    return {
      shadowColor: s.innerShadowColor || '#000000',
      shadowBlur: s.innerShadowBlur || 0,
      shadowOffset: {
        x: -(s.innerShadowOffsetX || 2),
        y: -(s.innerShadowOffsetY || 2),
      },
      shadowOpacity: s.innerShadowOpacity ?? 0.55,
    };
  }

  if ((s.bevelDepth || 0) > 0) {
    const depth = (s.bevelDepth || 0) / 100;
    return {
      shadowColor: s.bevelShadow || '#000000',
      shadowBlur: s.bevelSoftness || 4,
      shadowOffset: { x: 2 * depth * 4, y: 2 * depth * 4 },
      shadowOpacity: 0.35 + depth * 0.4,
    };
  }

  if ((s.satinOpacity || 0) > 0) {
    return {
      shadowColor: s.satinColor || '#ffffff',
      shadowBlur: s.satinBlur || 8,
      shadowOffset: { x: 0, y: 0 },
      shadowOpacity: s.satinOpacity || 0.25,
    };
  }

  return {
    shadowColor: s.shadowColor,
    shadowBlur: 0,
    shadowOffset: { x: 0, y: 0 },
    shadowOpacity: 0,
  };
}

/** Secondary FX that can be drawn as an extra Konva node (bevel highlight / satin). */
export function secondaryStyleOverlays(styles: LayerStyles | undefined): Array<{
  kind: 'bevel-highlight' | 'satin';
  color: string;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
}> {
  const s = styles || {};
  const out: Array<{
    kind: 'bevel-highlight' | 'satin';
    color: string;
    blur: number;
    opacity: number;
    offsetX: number;
    offsetY: number;
  }> = [];

  if ((s.bevelDepth || 0) > 0 && ((s.shadowBlur || 0) > 0 || (s.outerGlowBlur || 0) > 0)) {
    const depth = (s.bevelDepth || 0) / 100;
    out.push({
      kind: 'bevel-highlight',
      color: s.bevelHighlight || '#ffffff',
      blur: (s.bevelSoftness || 4) * 0.6,
      opacity: 0.25 + depth * 0.35,
      offsetX: -2 * depth * 3,
      offsetY: -2 * depth * 3,
    });
  }

  if ((s.satinOpacity || 0) > 0 && ((s.shadowBlur || 0) > 0 || (s.outerGlowBlur || 0) > 0)) {
    out.push({
      kind: 'satin',
      color: s.satinColor || '#ffffff',
      blur: s.satinBlur || 8,
      opacity: s.satinOpacity || 0.25,
      offsetX: 0,
      offsetY: 0,
    });
  }

  return out;
}

export function patternOverlayStyle(styles: LayerStyles | undefined): {
  color: string;
  opacity: number;
  scale: number;
} | null {
  const s = styles || {};
  if (!(s.patternOverlayOpacity && s.patternOverlayOpacity > 0)) return null;
  return {
    color: s.patternOverlayColor || '#d4923a',
    opacity: s.patternOverlayOpacity,
    scale: Math.max(4, s.patternOverlayScale || 12),
  };
}

/** Bake pattern overlay into image pixels (for export fidelity). */
export async function bakePatternOverlayIntoSrc(
  src: string,
  styles: LayerStyles | undefined
): Promise<string> {
  const pattern = patternOverlayStyle(styles);
  if (!pattern) return src;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const cell = pattern.scale;
      ctx.globalAlpha = pattern.opacity;
      ctx.fillStyle = pattern.color;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          if (((x / cell) + (y / cell)) % 2 < 1) {
            ctx.fillRect(x, y, cell / 2, cell / 2);
            ctx.fillRect(x + cell / 2, y + cell / 2, cell / 2, cell / 2);
          }
        }
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
