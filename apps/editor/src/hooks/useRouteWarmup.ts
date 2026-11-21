import { useEffect } from 'react';

type WarmTarget = () => Promise<unknown>;

/**
 * After first paint, warm heavy routes (EditorShell, etc.) during idle time
 * and on pointer intent — pairs with Speculation Rules in index.html.
 */
export function useRouteWarmup(importFn: WarmTarget, opts?: { idleMs?: number; timeoutMs?: number }) {
  const idleMs = opts?.idleMs ?? 1400;
  const timeoutMs = opts?.timeoutMs ?? 2500;

  useEffect(() => {
    let cancelled = false;
    let warmed = false;

    const warm = () => {
      if (cancelled || warmed) return;
      warmed = true;
      void importFn();
    };

    const ric = window.requestIdleCallback?.(warm, { timeout: timeoutMs });
    const fallback = ric == null ? window.setTimeout(warm, idleMs) : 0;

    const onIntent = () => warm();
    window.addEventListener('pointerdown', onIntent, { once: true, passive: true });
    window.addEventListener('keydown', onIntent, { once: true });

    return () => {
      cancelled = true;
      if (ric != null) window.cancelIdleCallback?.(ric);
      if (fallback) window.clearTimeout(fallback);
      window.removeEventListener('pointerdown', onIntent);
      window.removeEventListener('keydown', onIntent);
    };
  }, [importFn, idleMs, timeoutMs]);
}
