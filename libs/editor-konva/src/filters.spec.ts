import { describe, expect, it } from 'vitest';
import { hasAnyImageAdjustments, hasPhotoAdjustWork } from './filters';
import type { ImageAdjustments } from '@photoshop-lite/shared-types';

const identity: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  sharpness: 0,
  blur: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  invert: false,
  grayscale: false,
  sepia: false,
};

describe('filter helpers', () => {
  it('treats defaults as no work', () => {
    expect(hasAnyImageAdjustments(identity)).toBe(false);
    expect(hasPhotoAdjustWork(identity)).toBe(false);
  });

  it('detects brightness / blur', () => {
    expect(hasAnyImageAdjustments({ ...identity, brightness: 10 })).toBe(true);
    expect(hasAnyImageAdjustments({ ...identity, blur: 2 })).toBe(true);
    expect(hasPhotoAdjustWork({ ...identity, brightness: 10 })).toBe(false);
  });

  it('detects photo-adjust work', () => {
    expect(hasPhotoAdjustWork({ ...identity, exposure: -20 })).toBe(true);
    expect(hasPhotoAdjustWork({ ...identity, sepia: true })).toBe(true);
    expect(hasAnyImageAdjustments({ ...identity, exposure: -20 })).toBe(true);
  });
});
