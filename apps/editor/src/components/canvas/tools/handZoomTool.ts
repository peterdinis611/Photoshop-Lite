import type { ToolHandler } from './types';

const GRAB = 'cursor-grab active:cursor-grabbing';

/**
 * Hand tool. The dispatcher also routes Space+drag and middle-mouse here regardless of the
 * active tool, so panning state lives on the session.
 */
export const handTool: ToolHandler = {
  id: 'hand',

  onPointerDown: ({ evt }, ctx) => {
    const { pan } = ctx.getView();
    ctx.session.panning = true;
    ctx.session.panStart = { x: evt.clientX - pan.x, y: evt.clientY - pan.y };
  },

  onPointerMove: ({ evt }, ctx) => {
    const start = ctx.session.panStart;
    if (!ctx.session.panning || !start) return;
    ctx.getStore().setPan({ x: evt.clientX - start.x, y: evt.clientY - start.y });
  },

  onPointerUp: (_e, { session }) => {
    session.panning = false;
    session.panStart = null;
  },

  cursor: () => GRAB,
};

/** Zoom tool: click zooms in, Alt+click zooms out. */
export const zoomTool: ToolHandler = {
  id: 'zoom',

  onPointerDown: ({ altKey }, ctx) => {
    const factor = altKey ? 1 / 1.25 : 1.25;
    ctx.getStore().setZoom((z) => Math.min(8, Math.max(0.1, z * factor)));
  },

  cursor: () => 'cursor-zoom-in',
};
