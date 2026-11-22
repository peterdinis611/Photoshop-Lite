export type KonvaToolKind =
  | 'select'
  | 'hand'
  | 'zoom'
  | 'crop'
  | 'marquee'
  | 'lasso'
  | 'wand'
  | 'brush'
  | 'eraser'
  | 'heal'
  | 'clone'
  | 'blur'
  | 'fill'
  | 'eyedropper'
  | 'text'
  | 'shape'
  | 'refineBrush'
  | string;

export interface ListeningPolicy {
  /** Stage should receive pointer events for this tool */
  stageListening: boolean;
  /** Content layers (images/text/shapes) should be hittable */
  contentListening: boolean;
  /** Overlay FastLayer is interactive (crop handles, etc.) */
  overlayListening: boolean;
  /** Cursor hint class */
  cursor: string;
}

/** Tools that paint / pick on the stage — content layers must not steal hits. */
const CROSSHAIR_TOOLS = new Set<string>([
  'marquee',
  'lasso',
  'wand',
  'brush',
  'eraser',
  'heal',
  'spotHealing',
  'clone',
  'blur',
  'fill',
  'eyedropper',
  'refineBrush',
  'gradient',
  'dodge',
  'burn',
  'sharpenTool',
  'polyLasso',
  'magneticLasso',
  'quickSelect',
  'healing',
  'patch',
  'liquify',
  'text',
  'shape',
  'pen',
]);

const CONTENT_HIT_TOOLS = new Set<string>(['select']);

const OVERLAY_TOOLS = new Set<string>(['transform', 'crop']);

/**
 * Central listening rules so tools don't fight Transformer / layer drag.
 * Keep in sync with registered tool ids in `apps/editor/.../tools/index.ts`.
 */
export function listeningPolicy(activeTool: KonvaToolKind): ListeningPolicy {
  if (activeTool === 'hand') {
    return {
      stageListening: true,
      contentListening: false,
      overlayListening: false,
      cursor: 'grab',
    };
  }

  if (activeTool === 'zoom') {
    return {
      stageListening: true,
      contentListening: false,
      overlayListening: false,
      cursor: 'zoom-in',
    };
  }

  if (CONTENT_HIT_TOOLS.has(activeTool)) {
    return {
      stageListening: true,
      contentListening: true,
      // Transformer lives in the UI layer and must receive hits while Move is active
      overlayListening: true,
      cursor: 'default',
    };
  }

  if (OVERLAY_TOOLS.has(activeTool)) {
    return {
      stageListening: true,
      contentListening: false,
      overlayListening: true,
      cursor: activeTool === 'crop' ? 'crosshair' : 'default',
    };
  }

  if (CROSSHAIR_TOOLS.has(activeTool)) {
    return {
      stageListening: true,
      contentListening: false,
      overlayListening: false,
      cursor: 'crosshair',
    };
  }

  // Unknown tools: prefer stage-only so content doesn't steal unexpected hits
  return {
    stageListening: true,
    contentListening: false,
    overlayListening: false,
    cursor: 'default',
  };
}
