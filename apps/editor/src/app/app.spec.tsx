import { describe, it, expect } from 'vitest';
import { FILTER_PRESETS, DEFAULT_ADJUSTMENTS } from '../utils/filterHelpers';
import { SAMPLE_IMAGES } from '../assets/sampleImages';

describe('Photoshop-Lite Core Engine', () => {
  it('should define default adjustments correctly', () => {
    expect(DEFAULT_ADJUSTMENTS.brightness).toBe(0);
    expect(DEFAULT_ADJUSTMENTS.contrast).toBe(0);
    expect(DEFAULT_ADJUSTMENTS.saturation).toBe(0);
    expect(DEFAULT_ADJUSTMENTS.exposure).toBe(0);
  });

  it('should provide presets for one-click revival & color grading', () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(6);
    const vivid = FILTER_PRESETS.find((p) => p.id === 'vivid');
    expect(vivid).toBeDefined();
    expect(vivid?.adjustments.contrast).toBeGreaterThan(0);
  });

  it('should provide sample demo images for testing', () => {
    expect(SAMPLE_IMAGES.length).toBeGreaterThanOrEqual(3);
    const portrait = SAMPLE_IMAGES.find((s) => s.id === 'sample-portrait');
    expect(portrait).toBeDefined();
    expect(portrait?.dataUrl).toContain('data:image/svg+xml');
  });

  it('should have background removal module defined', async () => {
    const bgModule = await import('../utils/backgroundRemoval');
    expect(bgModule.executeBackgroundRemoval).toBeDefined();
    expect(bgModule.smartSegmentBackground).toBeDefined();
  });
});
