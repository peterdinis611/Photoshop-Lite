export { AppError, getErrorMessage } from './errors';
export type { ErrorCode } from './errors';
export { deepClone, clamp, debounce } from './optimize';

export {
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  analyzeAndAutoEnhance,
  clientSideSuperResolution,
} from './filterHelpers';
export type { FilterPreset } from './filterHelpers';

export {
  REVIVE_MODES,
  computeReviveAdjustments,
  bakeRevivePixels,
  mixAdjustments,
} from './photoRevive';
export type { ReviveMode, ReviveModeMeta } from './photoRevive';

export { CLEANUP_MODES, bakeCleanupPixels } from './photoCleanup';
export type { CleanupMode, CleanupModeMeta } from './photoCleanup';

export {
  PROJECT_FILE_EXTENSION,
  buildProjectFile,
  serializeProject,
  parseProjectFile,
  downloadProjectFile,
  readProjectFile,
} from './projectFile';

export { paintStrokeOnMask, clearImageRect, clearImageSelection, magicWandBounds } from './maskHelpers';
export { selectionToMaskDataUrl } from './selectionMask';
export {
  sampleCanvasColor,
  applySpotHealingToImage,
  applyCloneStampToImage,
} from './retouchHelpers';

export { floodFillImage } from './floodFill';
export { applyBlurSpotToImage } from './blurSpot';
