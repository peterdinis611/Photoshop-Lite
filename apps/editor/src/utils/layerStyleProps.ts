import type { LayerStyles } from '../types/editor';

/** Map LayerStyles → Konva shadow / stroke props (browser FX approximations). */
export function layerShadowProps(styles: LayerStyles | undefined) {
  const s = styles || {};
  const useGlow = (s.outerGlowBlur || 0) > 0;
  const useInner = !useGlow && (s.innerShadowBlur || 0) > 0;
  const useBevel = !useGlow && !useInner && (s.bevelDepth || 0) > 0;
  const useSatin = !useGlow && !useInner && !useBevel && (s.satinOpacity || 0) > 0;

  if (useGlow) {
    return {
      shadowColor: s.outerGlowColor || '#e8a84a',
      shadowBlur: s.outerGlowBlur || 0,
      shadowOffset: { x: 0, y: 0 },
      shadowOpacity: 0.85,
    };
  }

  if (useInner) {
    // Approximate inner shadow with offset drop shadow toward the interior
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

  if (useBevel) {
    const depth = (s.bevelDepth || 0) / 100;
    return {
      shadowColor: s.bevelShadow || '#000000',
      shadowBlur: s.bevelSoftness || 4,
      shadowOffset: { x: 2 * depth * 4, y: 2 * depth * 4 },
      shadowOpacity: 0.35 + depth * 0.4,
    };
  }

  if (useSatin) {
    return {
      shadowColor: s.satinColor || '#ffffff',
      shadowBlur: s.satinBlur || 8,
      shadowOffset: { x: 0, y: 0 },
      shadowOpacity: s.satinOpacity || 0.25,
    };
  }

  return {
    shadowColor: s.shadowColor,
    shadowBlur: s.shadowBlur || 0,
    shadowOffset: {
      x: s.shadowOffsetX || 0,
      y: s.shadowOffsetY || 0,
    },
    shadowOpacity: s.shadowOpacity || 0,
  };
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
