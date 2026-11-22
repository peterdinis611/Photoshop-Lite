import type { ToolHandler } from './types';

/**
 * Move tool — layer drag/transform is Konva-native (draggable + Transformer).
 * This handler exists so Space/middle-pan routing and empty-canvas deselection
 * stay consistent; pointer-down returns false so the stage can clear selection
 * only on the document background.
 */
export const selectTool: ToolHandler = {
  id: 'select',

  onPointerDown: () => false,

  cursor: () => 'cursor-default',
};
