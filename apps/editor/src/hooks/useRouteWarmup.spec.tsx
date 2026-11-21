import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRouteWarmup } from './useRouteWarmup';

describe('useRouteWarmup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('warms on idle timeout when requestIdleCallback is missing', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const importFn = vi.fn().mockResolvedValue({});
    renderHook(() => useRouteWarmup(importFn, { idleMs: 100, timeoutMs: 200 }));
    expect(importFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('warms only once even if idle and pointer both fire', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const importFn = vi.fn().mockResolvedValue({});
    renderHook(() => useRouteWarmup(importFn, { idleMs: 500, timeoutMs: 500 }));
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(500);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('uses requestIdleCallback when available', () => {
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 10 } as IdleDeadline);
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', ric);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    const importFn = vi.fn().mockResolvedValue({});
    renderHook(() => useRouteWarmup(importFn, { idleMs: 9999, timeoutMs: 50 }));
    expect(ric).toHaveBeenCalled();
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
