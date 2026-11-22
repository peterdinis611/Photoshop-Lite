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

export { RELIGHT_MODES, bakeRelightPixels, relightCloudPrompt } from './photoRelight';
export type { RelightMode, RelightModeMeta } from './photoRelight';

export { PORTRAIT_MODES, bakePortraitPixels } from './photoPortrait';
export type { PortraitMode, PortraitModeMeta } from './photoPortrait';

export { CLARITY_MODES, bakeClarityPixels } from './photoClarity';
export type { ClarityMode, ClarityModeMeta } from './photoClarity';

export { bakeColorMatchPixels } from './photoColorMatch';

export {
  OUTPAINT_PRESETS,
  computeOutpaintLayout,
  expandImageWithEdgeFill,
  buildOutpaintBorderMask,
  rasterizeImageToSize,
} from './photoOutpaint';
export type { OutpaintPreset, OutpaintModeMeta, OutpaintLayout } from './photoOutpaint';

export {
  PROJECT_FILE_EXTENSION,
  buildProjectFile,
  serializeProject,
  parseProjectFile,
  downloadProjectFile,
  readProjectFile,
} from './projectFile';

export {
  paintStrokeOnMask,
  eraseStrokeOnImage,
  clearImageRect,
  clearImageSelection,
  magicWandBounds,
} from './maskHelpers';
export { selectionToMaskDataUrl } from './selectionMask';
export {
  sampleCanvasColor,
  applySpotHealingToImage,
  applyCloneStampToImage,
} from './retouchHelpers';

export { floodFillImage } from './floodFill';
export { applyBlurSpotToImage } from './blurSpot';

export { colorRangeSelect, fillImageRect, colorDist } from './colorRange';
export type { ColorRangeOptions, ColorRangeResult, ColorRangeSample } from './colorRange';

export {
  DEFAULT_CURVES,
  DEFAULT_LEVELS,
  buildCurveLut,
  applyCurvesToImageData,
  applyLevelsToImageData,
  bakeCurvesLevels,
} from './curvesLevels';
export type { LevelsParams } from './curvesLevels';

export {
  applyGaussianBlurImageData,
  applyUnsharpMaskImageData,
  applyNoiseImageData,
  applySharpenImageData,
  bakeClassicFilter,
} from './classicFilters';
export type { ClassicFilterKind } from './classicFilters';

export {
  invertSelection,
  expandSelection,
  contractSelection,
  featherSelectionMask,
} from './selectionModify';

export { applyToneBrushToImage } from './toneBrush';
export type { ToneBrushMode, ToneBrushOptions } from './toneBrush';

export { createLinearGradientDataUrl, createRadialGradientDataUrl } from './gradientFill';
export type {
  GradientColorStop,
  LinearGradientOptions,
  RadialGradientOptions,
} from './gradientFill';

export { applyHealingBrushToImage, applyPatchToImage } from './healingBrush';
export type { HealingBrushOptions, PatchOptions } from './healingBrush';

export { buildLuminanceGradient, snapToEdge } from './magneticEdge';
export type { PixelBuffer } from './magneticEdge';

export {
  LIQUIFY_MODES,
  liquifyPixels,
  applyLiquifyBrush,
  clearLiquifySnapshotCache,
} from './liquify';
export type { LiquifyMode, LiquifyBrushOptions } from './liquify';

export {
  quadBounds,
  squareToQuadMatrix,
  mapUnitToQuad,
  createProjectiveInverse,
  createBilinearInverse,
  resolveQuad,
  warpPixelsToQuad,
  warpImagePerspective,
  warpImagePerspectiveDetailed,
} from './perspectiveWarp';
export type { Quad, WarpMethod, WarpOptions, WarpResult, WarpedImage } from './perspectiveWarp';

export { perspectiveCropToRect } from './perspectiveCrop';

export { extractImageExif } from './imageExif';
export type { ImageExifSummary } from './imageExif';

export { extractPaletteFromImage } from './extractPalette';
export type { ExtractedPalette } from './extractPalette';

export { compressImageSource } from './imageCompress';
export type { CompressFormat, CompressOptions, CompressResult } from './imageCompress';

export { COLORIZE_PRESETS, colorizeImageSource } from './imageColorize';
export type { ColorizePreset, ColorizePresetMeta } from './imageColorize';
