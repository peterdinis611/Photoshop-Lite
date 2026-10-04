import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  getErrorMessage,
  clamp,
  deepClone,
  debounce,
  parseProjectFile,
  buildProjectFile,
  serializeProject,
  PROJECT_FILE_EXTENSION,
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  computeReviveAdjustments,
  mixAdjustments,
  REVIVE_MODES,
  CLEANUP_MODES,
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

  it('debounces calls and supports cancel', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 50);
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(1);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('projectFile', () => {
  it('uses the .psl.json extension', () => {
    expect(PROJECT_FILE_EXTENSION).toBe('.psl.json');
  });

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

  it('serializeProject returns valid JSON', () => {
    const project = buildProjectFile({
      title: 'Ser',
      canvasWidth: 100,
      canvasHeight: 100,
      backgroundColor: '#fff',
      layers: [{ id: '1', type: 'image', name: 'A' }],
    });
    const raw = serializeProject(project);
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(parseProjectFile(raw).title).toBe('Ser');
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports presets and defaults', () => {
    expect(FILTER_PRESETS.length).toBeGreaterThan(3);
    expect(DEFAULT_ADJUSTMENTS.brightness).toBe(0);
  });

  it('lists revive and cleanup modes', () => {
    expect(REVIVE_MODES.map((m) => m.id)).toEqual(
      expect.arrayContaining(['natural', 'vivid', 'shadows'])
    );
    expect(CLEANUP_MODES.map((m) => m.id)).toEqual(
      expect.arrayContaining(['gentle', 'standard', 'strong'])
    );
  });

  it('mixAdjustments lerps numeric fields by intensity', () => {
    const base = { ...DEFAULT_ADJUSTMENTS, brightness: 0, contrast: 0 };
    const target = { ...DEFAULT_ADJUSTMENTS, brightness: 100, contrast: 50 };
    const mid = mixAdjustments(base, target, 0.5);
    expect(mid.brightness).toBe(50);
    expect(mid.contrast).toBe(25);

    const full = mixAdjustments(base, target, 1);
    expect(full.brightness).toBe(100);
    expect(full.contrast).toBe(50);

    const none = mixAdjustments(base, target, 0);
    expect(none.brightness).toBe(0);
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
