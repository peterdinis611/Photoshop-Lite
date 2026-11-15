import type React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type Konva from 'konva';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../types/editor';
import { createToolContext, createToolSession, disposeToolSession } from './context';
import { getToolHandler } from './registry';
import type { Point, ToolContext, ToolPointerEvent, ToolSession } from './types';

type StageMouseEvent = Konva.KonvaEventObject<MouseEvent>;

export interface ToolDispatch {
  session: ToolSession;
  ctx: ToolContext;
  onMouseDown: (e: StageMouseEvent) => Promise<void>;
  onMouseMove: (e: StageMouseEvent) => void;
  onMouseUp: (e: StageMouseEvent) => Promise<void>;
  onMouseLeave: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** Konva overlay nodes of the active tool (document space). */
  renderOverlay: () => React.ReactNode;
  /** Interactive Konva nodes of the active tool (UI layer). */
  renderUi: () => React.ReactNode;
  /** DOM hints of the active tool. */
  renderHud: () => React.ReactNode;
  /** Tailwind cursor class from the active tool, if it defines one. */
  cursorClass: () => string | undefined;
}

/** Document coordinates of the pointer (corrected for pan + zoom). */
function getCanvasCoords(e: StageMouseEvent): Point {
  const stage = e.target.getStage();
  const pointer = stage?.getPointerPosition();
  if (!pointer) return { x: 0, y: 0 };
  const { pan, zoom } = useEditorStore.getState();
  return {
    x: Math.round((pointer.x - pan.x) / zoom),
    y: Math.round((pointer.y - pan.y) / zoom),
  };
}

function toToolEvent(e: StageMouseEvent, point: Point): ToolPointerEvent {
  const { evt } = e;
  return { point, evt, shiftKey: evt.shiftKey, altKey: evt.altKey, metaKey: evt.metaKey };
}

/**
 * Routes Konva stage events to the registered handler of the active tool.
 *
 * - Space+drag and middle-mouse always go to the Hand tool.
 * - Pointer-up goes to the tool that received the pointer-down, so switching tools mid-drag
 *   still finishes the gesture.
 * - `onUnhandledPointerDown` runs when the tool has no pointer-down handler (or returned
 *   `false`), e.g. to deselect on the empty canvas.
 */
export function useToolDispatch(options: {
  activeTool: ToolType;
  onUnhandledPointerDown?: (e: StageMouseEvent, ctx: ToolContext) => void;
}): ToolDispatch {
  const { activeTool, onUnhandledPointerDown } = options;
  const [session] = useState(createToolSession);
  const [, requestRedraw] = useReducer((n: number) => n + 1, 0);
  const ctx = useMemo(() => createToolContext(session, requestRedraw), [session]);

  useEffect(() => () => disposeToolSession(session), [session]);

  // Drop in-progress drafts when switching away from a tool
  useEffect(() => {
    return () => {
      const handler = getToolHandler(activeTool);
      if (!handler?.onDeactivate) return;
      ctx.tool = activeTool;
      handler.onDeactivate(ctx);
      ctx.requestRedraw();
    };
  }, [activeTool, ctx]);

  const finishGesture = useCallback(
    async (e: StageMouseEvent) => {
      const tool = session.downTool ?? activeTool;
      session.downTool = null;
      const handler = getToolHandler(tool);
      if (!handler?.onPointerUp) return;
      ctx.tool = tool;
      await handler.onPointerUp(toToolEvent(e, getCanvasCoords(e)), ctx);
      ctx.requestRedraw();
    },
    [activeTool, ctx, session]
  );

  const onMouseDown = useCallback(
    async (e: StageMouseEvent) => {
      // The previous gesture never saw a pointer-up (released outside the stage) — close it first
      if (session.downTool) await finishGesture(e);

      const wantsPan = session.spacePressed || activeTool === 'hand' || e.evt.button === 1;
      const tool: ToolType = wantsPan ? 'hand' : activeTool;
      const handler = getToolHandler(tool);

      session.downTool = tool;
      if (!handler?.onPointerDown) {
        onUnhandledPointerDown?.(e, ctx);
        ctx.requestRedraw();
        return;
      }

      ctx.tool = tool;
      const result = handler.onPointerDown(toToolEvent(e, getCanvasCoords(e)), ctx);
      ctx.requestRedraw();
      const handled = result instanceof Promise ? await result : result;
      if (handled === false) onUnhandledPointerDown?.(e, ctx);
      ctx.requestRedraw();
    },
    [activeTool, ctx, finishGesture, onUnhandledPointerDown, session]
  );

  const onMouseMove = useCallback(
    (e: StageMouseEvent) => {
      const point = getCanvasCoords(e);
      session.cursorPos = point;
      const tool: ToolType = session.panning ? 'hand' : activeTool;
      const handler = getToolHandler(tool);
      if (handler?.onPointerMove) {
        ctx.tool = tool;
        handler.onPointerMove(toToolEvent(e, point), ctx);
      }
      ctx.requestRedraw();
    },
    [activeTool, ctx, session]
  );

  const onMouseUp = useCallback(
    async (e: StageMouseEvent) => {
      await finishGesture(e);
      ctx.requestRedraw();
    },
    [ctx, finishGesture]
  );

  const onMouseLeave = useCallback(() => {
    session.cursorPos = null;
    session.eyedropperPreview = null;
    ctx.requestRedraw();
  }, [ctx, session]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const handler = getToolHandler(activeTool);
      if (!handler?.onKeyDown) return;
      ctx.tool = activeTool;
      handler.onKeyDown(e, ctx);
      ctx.requestRedraw();
    },
    [activeTool, ctx]
  );

  const active = getToolHandler(activeTool);
  const renderOverlay = () => {
    ctx.tool = activeTool;
    return active?.renderOverlay?.(ctx) ?? null;
  };
  const renderUi = () => {
    ctx.tool = activeTool;
    return active?.renderUi?.(ctx) ?? null;
  };
  const renderHud = () => {
    ctx.tool = activeTool;
    return active?.renderHud?.(ctx) ?? null;
  };
  const cursorClass = () => {
    ctx.tool = activeTool;
    return active?.cursor?.(ctx);
  };

  return {
    session,
    ctx,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onKeyDown,
    renderOverlay,
    renderUi,
    renderHud,
    cursorClass,
  };
}
