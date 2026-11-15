import { AsyncThrottler } from '@tanstack/react-pacer';
import type { ToolSession } from './types';

/**
 * Serialized "latest wins" runner for async per-pixel strokes: only one image round-trip is
 * in flight at a time, and while it runs only the newest queued task is kept.
 */
export function runLatest(session: ToolSession, task: () => Promise<void>): void {
  const runner = session.runner;
  if (runner.busy) {
    runner.pending = task;
    return;
  }
  runner.busy = true;
  void (async () => {
    let next: (() => Promise<void>) | null = task;
    while (next) {
      runner.pending = null;
      try {
        await next();
      } catch (err) {
        console.error('Canvas stroke failed:', err);
      }
      next = runner.pending;
    }
    runner.busy = false;
  })();
}

/**
 * Leading + trailing async throttle, one instance per `key` for the lifetime of the session.
 * `fn` must be a stable function that reads fresh state itself (it is only captured once).
 */
export function runThrottled<A extends unknown[]>(
  session: ToolSession,
  key: string,
  wait: number,
  fn: (...args: A) => Promise<void>,
  ...args: A
): void {
  let throttler = session.throttlers.get(key) as AsyncThrottler<typeof fn> | undefined;
  if (!throttler) {
    throttler = new AsyncThrottler(fn, {
      wait,
      leading: true,
      trailing: true,
      onError: (err) => console.error(`Canvas ${key} stroke failed:`, err),
    });
    session.throttlers.set(key, throttler);
  }
  void throttler.maybeExecute(...args);
}
