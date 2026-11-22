/**
 * Importing this module registers every canvas tool. To add a tool: create `myTool.ts`
 * exporting a `ToolHandler`, then add it to the list below.
 */
import { registerTool } from './registry';
import { blurTool } from './blurTool';
import { brushTool } from './brushTool';
import { cropTool } from './cropTool';
import { eyedropperTool } from './eyedropperTool';
import { fillTool } from './fillTool';
import { gradientTool } from './gradientTool';
import { handTool, zoomTool } from './handZoomTool';
import { cloneStampTool, healingBrushTool, patchTool, spotHealingTool } from './healingTools';
import { liquifyTool } from './liquifyTool';
import { penTool } from './penTool';
import { selectTool } from './selectTool';
import {
  lassoTool,
  marqueeTool,
  polygonLassoTool,
  quickSelectTool,
  wandTool,
} from './selectionTools';
import { shapeTool } from './shapeTool';
import { textTool } from './textTool';
import { toneBrushTool } from './toneBrushTool';
import { transformTool } from './transformTool';

const TOOLS = [
  selectTool,
  handTool,
  zoomTool,
  eyedropperTool,
  fillTool,
  gradientTool,
  toneBrushTool,
  liquifyTool,
  blurTool,
  brushTool,
  spotHealingTool,
  cloneStampTool,
  healingBrushTool,
  patchTool,
  marqueeTool,
  lassoTool,
  polygonLassoTool,
  quickSelectTool,
  wandTool,
  textTool,
  shapeTool,
  penTool,
  cropTool,
  transformTool,
];

for (const tool of TOOLS) registerTool(tool);

export { getToolHandler, registerTool, listRegisteredTools } from './registry';
export { useToolDispatch } from './useToolDispatch';
export { renderSelectionOverlay } from './selectionTools';
export { CropOverlay, CropControlBar } from './cropTool';
export { getTransformerConfig } from './transformTool';
export type * from './types';
