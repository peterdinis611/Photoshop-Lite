import type { ToolHandler } from './types';

/** Type tool — click to place a text layer. */
export const textTool: ToolHandler = {
  id: 'text',
  onPointerDown: ({ point }, ctx) => {
    ctx.getStore().addTextLayer({ x: point.x, y: point.y });
  },
  cursor: () => 'cursor-text',
};
