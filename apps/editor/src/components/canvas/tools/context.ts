import { useEditorStore } from '../../../store/editorStore';
import type { ToolContext, ToolSession } from './types';

export function createToolSession(): ToolSession {
  return {
    cursorPos: null,
    downTool: null,

    spacePressed: false,
    panning: false,
    panStart: null,

    brushStroke: null,
    brushPreview: null,

    shapeStart: null,
    shapePreview: null,

    marqueeStart: null,
    marqueePreview: null,
    lassoDrawing: false,
    lassoPreview: null,

    polyPoints: [],
    magneticDragging: false,
    magneticEdge: null,

    quickSelect: null,

    cloneSource: null,
    cloneOffset: null,
    cloning: false,
    spotHealing: false,
    blurring: false,

    healStroke: null,
    healPreview: null,
    patchDrawing: false,
    patchPreview: null,

    gradientDrag: null,

    toneStroke: null,
    liquifyStroke: null,
    liquifyOriginals: new Map(),
    runner: { busy: false, pending: null },

    penAnchors: [],
    penDragging: false,
    penCursor: null,

    warpCorners: null,
    warpBusy: false,

    eyedropperPreview: null,

    throttlers: new Map(),
  };
}

/** Cancel pending throttled work (call on unmount). */
export function disposeToolSession(session: ToolSession): void {
  for (const throttler of session.throttlers.values()) throttler.cancel();
}

export function createToolContext(session: ToolSession, requestRedraw: () => void): ToolContext {
  return {
    tool: 'select',
    session,
    requestRedraw,
    getStore: () => useEditorStore.getState(),
    getSelectedImageLayer: () => {
      const state = useEditorStore.getState();
      const layer = state.layers.find((l) => l.id === state.selectedLayerId);
      return layer?.type === 'image' ? layer : null;
    },
    getView: () => {
      const { zoom, pan, canvasWidth, canvasHeight } = useEditorStore.getState();
      return { zoom, pan, canvasWidth, canvasHeight };
    },
  };
}
