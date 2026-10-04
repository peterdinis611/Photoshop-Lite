import { describe, expect, it } from 'vitest';
import {
  AppError,
  getErrorMessage,
  clamp,
  deepClone,
  parseProjectFile,
  buildProjectFile,
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  computeReviveAdjustments,
} from './index';

describe('AppError', () => {
  it('wraps unknown values', () => {
    const err = AppError.fromUnknown('boom');
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('boom');
    expect(err.code).toBe('INTERNAL');
  });

  it('preserves AppError instances', () => {
    const original = new AppError('x', { code: 'VALIDATION' });
    expect(AppError.fromUnknown(original)).toBe(original);
  });

  it('getErrorMessage falls back', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(new Error('hi'))).toBe('hi');
  });
});

describe('optimize helpers', () => {
  it('clamps numbers', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('deepClones plain objects', () => {
    const src = { a: 1, b: { c: [1, 2] } };
    const copy = deepClone(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
    expect(copy.b).not.toBe(src.b);
  });
});

describe('projectFile', () => {
  it('round-trips a project', () => {
    const project = buildProjectFile({
      title: 'Test',
      canvasWidth: 800,
      canvasHeight: 600,
      backgroundColor: '#000',
      layers: [],
    });
    const parsed = parseProjectFile(JSON.stringify(project));
    expect(parsed.title).toBe('Test');
    expect(parsed.canvasWidth).toBe(800);
    expect(parsed.layers).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseProjectFile('{nope')).toThrow(AppError);
  });

  it('rejects missing version', () => {
    expect(() =>
      parseProjectFile(JSON.stringify({ canvasWidth: 1, canvasHeight: 1, layers: [] }))
    ).toThrow(/Unsupported project version/);
  });
});

describe('filters & revive', () => {
  it('exports presets and defaults', () => {
    expect(FILTER_PRESETS.length).toBeGreaterThan(3);
    expect(DEFAULT_ADJUSTMENTS.brightness).toBe(0);
  });

  it('computeReviveAdjustments returns defaults for empty image', () => {
    const img = new Image();
    Object.defineProperty(img, 'width', { value: 0 });
    Object.defineProperty(img, 'height', { value: 0 });
    Object.defineProperty(img, 'naturalWidth', { value: 0 });
    Object.defineProperty(img, 'naturalHeight', { value: 0 });
    const result = computeReviveAdjustments(img, 'natural', 0.5);
    expect(result).toMatchObject({
      brightness: expect.any(Number),
      contrast: expect.any(Number),
      saturation: expect.any(Number),
    });
  });
});
