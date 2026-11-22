import { describe, expect, it } from 'vitest';
import { isLottieAnimationData, isLottieFile } from './lottieDetect';

describe('isLottieAnimationData', () => {
  it('accepts Bodymovin compositions', () => {
    expect(
      isLottieAnimationData({
        v: '5.7.4',
        fr: 30,
        ip: 0,
        op: 60,
        w: 200,
        h: 200,
        layers: [{ ind: 1, ty: 4, nm: 'Shape' }],
      })
    ).toBe(true);
  });

  it('rejects PixelLite project JSON', () => {
    expect(
      isLottieAnimationData({
        version: 1,
        canvasWidth: 800,
        canvasHeight: 600,
        layers: [{ id: 'a', type: 'image', name: 'Photo', src: 'x' }],
      })
    ).toBe(false);
  });

  it('rejects empty / unrelated JSON', () => {
    expect(isLottieAnimationData({})).toBe(false);
    expect(isLottieAnimationData({ layers: [] })).toBe(false);
    expect(isLottieAnimationData(null)).toBe(false);
  });
});

describe('isLottieFile', () => {
  it('detects extensions', () => {
    expect(isLottieFile(new File([], 'anim.json', { type: 'application/json' }))).toBe(true);
    expect(isLottieFile(new File([], 'pack.lottie'))).toBe(true);
    expect(isLottieFile(new File([], 'photo.png', { type: 'image/png' }))).toBe(false);
  });
});
