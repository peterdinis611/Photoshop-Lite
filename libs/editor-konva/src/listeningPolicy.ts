export type KonvaToolKind =
  | 'select'
  | 'hand'
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

/** Central listening rules so tools don't fight Transformer / layer drag. */
export function listeningPolicy(activeTool: KonvaToolKind): ListeningPolicy {
  switch (activeTool) {
    case 'select':
      return {
        stageListening: true,
        contentListening: true,
        overlayListening: false,
        cursor: 'default',
      };
    case 'hand':
      return {
        stageListening: true,
        contentListening: false,
        overlayListening: false,
        cursor: 'grab',
      };
    case 'transform':
      // Transformer lives in the overlay layer and attaches to the selected layer
      return {
        stageListening: true,
        contentListening: false,
        overlayListening: true,
        cursor: 'default',
      };
    case 'crop':
      return {
        stageListening: true,
        contentListening: false,
        overlayListening: true,
        cursor: 'crosshair',
      };
    case 'marquee':
    case 'lasso':
    case 'wand':
    case 'brush':
    case 'eraser':
    case 'heal':
    case 'spotHealing':
    case 'clone':
    case 'blur':
    case 'fill':
    case 'eyedropper':
    case 'refineBrush':
    case 'gradient':
    case 'dodge':
    case 'burn':
    case 'sharpenTool':
    case 'polyLasso':
    case 'magneticLasso':
    case 'quickSelect':
    case 'healing':
    case 'patch':
    case 'liquify':
      return {
        stageListening: true,
        contentListening: false,
        overlayListening: false,
        cursor: 'crosshair',
      };
    case 'text':
    case 'shape':
    case 'pen':
      return {
        stageListening: true,
        contentListening: false,
        overlayListening: false,
        cursor: 'crosshair',
      };
    default:
      return {
        stageListening: true,
        contentListening: true,
        overlayListening: false,
        cursor: 'default',
      };
  }
}
