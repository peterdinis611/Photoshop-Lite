import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToolSession } from './context';
import { handTool, zoomTool } from './handZoomTool';
import type { ToolContext, ToolPointerEvent } from './types';

function fakeEvt(partial: Partial<MouseEvent> & { clientX?: number; clientY?: number }): ToolPointerEvent {
  return {
    point: { x: 0, y: 0 },
    evt: { clientX: 0, clientY: 0, ...partial } as MouseEvent,
    shiftKey: false,
    altKey: Boolean(partial.altKey),
    metaKey: false,
  };
}

describe('handTool', () => {
  let session: ReturnType<typeof createToolSession>;
  let setPan: ReturnType<typeof vi.fn>;
  let ctx: ToolContext;

  beforeEach(() => {
    session = createToolSession();
    setPan = vi.fn();
    ctx = {
      tool: 'hand',
      session,
      requestRedraw: vi.fn(),
      getStore: () => ({ setPan }) as never,
      getSelectedImageLayer: () => null,
      getView: () => ({ zoom: 1, pan: { x: 10, y: 20 }, canvasWidth: 800, canvasHeight: 600 }),
    };
  });

  it('pans relative to the starting pointer', () => {
    handTool.onPointerDown?.(fakeEvt({ clientX: 100, clientY: 200 }), ctx);
    expect(session.panning).toBe(true);
    expect(session.panStart).toEqual({ x: 90, y: 180 });

    handTool.onPointerMove?.(fakeEvt({ clientX: 130, clientY: 220 }), ctx);
    expect(setPan).toHaveBeenCalledWith({ x: 40, y: 40 });

    handTool.onPointerUp?.(fakeEvt({}), ctx);
    expect(session.panning).toBe(false);
    expect(session.panStart).toBeNull();
  });

  it('ignores move when not panning', () => {
    handTool.onPointerMove?.(fakeEvt({ clientX: 50, clientY: 50 }), ctx);
    expect(setPan).not.toHaveBeenCalled();
  });
});

describe('zoomTool', () => {
  it('zooms in and out via setZoom updater', () => {
    const setZoom = vi.fn((fn: (z: number) => number) => fn(1));
    const ctx = {
      tool: 'zoom' as const,
      session: createToolSession(),
      requestRedraw: vi.fn(),
      getStore: () => ({ setZoom }) as never,
      getSelectedImageLayer: () => null,
      getView: () => ({ zoom: 1, pan: { x: 0, y: 0 }, canvasWidth: 800, canvasHeight: 600 }),
    };

    zoomTool.onPointerDown?.(fakeEvt({ altKey: false }), ctx);
    expect(setZoom).toHaveBeenCalled();
    expect(setZoom.mock.calls[0][0](1)).toBeCloseTo(1.25);

    zoomTool.onPointerDown?.(fakeEvt({ altKey: true }), ctx);
    expect(setZoom.mock.calls[1][0](1)).toBeCloseTo(0.8);
  });
});
