import { create } from 'zustand';
import {
  EditorLayer,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  DrawingLayer,
  PathLayer,
  PathAnchor,
  ToolType,
  ShapeType,
  BlendMode,
  BrushSettings,
  PenSettings,
  ShapeSettings,
  TextSettings,
  CropSettings,
  HistorySnapshot,
  AIStatus,
  ImageAdjustments,
  ProjectFileData,
  MarqueeMode,
  SelectionShape,
  AdjustmentLayer,
  AdjustmentLayerKind,
  GradientLayer,
  GradientSettings,
  ToneBrushSettings,
  Guide,
  Artboard,
  EditorAction,
  EditorActionStep,
  TransformMode,
  LevelsAdjustment,
  CurvesAdjustment,
  DEFAULT_PEN_SETTINGS,
  DEFAULT_SHAPE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRADIENT_SETTINGS,
  DEFAULT_TONE_BRUSH,
} from '../types/editor';
import { normalizeAnchors, pathBounds } from '../utils/pathHelpers';
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS, clientSideSuperResolution, deepClone, getErrorMessage, bakeRevivePixels, computeReviveAdjustments, bakeCleanupPixels, bakeRelightPixels, bakePortraitPixels, bakeClarityPixels, bakeColorMatchPixels, computeOutpaintLayout, expandImageWithEdgeFill, buildOutpaintBorderMask, rasterizeImageToSize, buildProjectFile, downloadProjectFile, selectionToMaskDataUrl, compressImageSource, colorizeImageSource, extractImageExif, bakeCurvesLevels, DEFAULT_CURVES, DEFAULT_LEVELS, bakeClassicFilter, invertSelection, expandSelection, contractSelection, featherSelectionMask, createLinearGradientDataUrl, createRadialGradientDataUrl, type ClassicFilterKind, type ReviveMode, type CleanupMode, type RelightMode, type PortraitMode, type ClarityMode, type OutpaintPreset, type ColorizePreset, type CompressFormat, type ImageExifSummary } from '@photoshop-lite/editor-core';
import { executeBackgroundRemoval, aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { AiJobKind, AiStylePreset, AiRelightPreset, ProjectSummaryDto } from '@photoshop-lite/shared-types';
import { resizeImageSource } from '../utils/resizeImage';
import { applyCropToImageLayer } from '../utils/cropImage';

/** Unique layer name: "Portrait · Revived", "Portrait · Revived 2", … */
function uniqueLayerName(base: string, layers: EditorLayer[]): string {
  const names = new Set(layers.map((l) => l.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function derivativeName(sourceName: string, suffix: string, layers: EditorLayer[]): string {
  const root = sourceName
    .replace(/\s*·\s*(Revived|Cleaned)(\s+\d+)?$/i, '')
    .replace(/\s*\((Cutout|\d+x Upscaled)\)(\s+\d+)?$/i, '')
    .trim();
  return uniqueLayerName(`${root} · ${suffix}`, layers);
}

function makeId(tag: string): string {
  return `${Date.now()}_${tag}_${Math.random().toString(36).substring(2, 6)}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

const ADJUSTMENT_LABELS: Record<AdjustmentLayerKind, string> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  levels: 'Levels',
  curves: 'Curves',
  hueSaturation: 'Hue/Saturation',
  invert: 'Invert',
  grayscale: 'Black & White',
};

/** Flatten a bezier path layer into document-space [x,y,…] points (honours scale + rotation). */
function flattenPathLayer(layer: PathLayer, segments = 16): number[] {
  const { anchors, closed } = layer;
  if (anchors.length === 0) return [];
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toDoc = (px: number, py: number): [number, number] => {
    const lx = px * layer.scaleX;
    const ly = py * layer.scaleY;
    return [layer.x + lx * cos - ly * sin, layer.y + lx * sin + ly * cos];
  };

  const out: number[] = [];
  const pushPoint = (px: number, py: number) => {
    const [dx, dy] = toDoc(px, py);
    out.push(dx, dy);
  };

  const count = closed ? anchors.length : anchors.length - 1;
  pushPoint(anchors[0].x, anchors[0].y);
  for (let i = 0; i < count; i += 1) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const hasCurve =
      !!(a.handleOutX || a.handleOutY || b.handleInX || b.handleInY);
    if (!hasCurve) {
      pushPoint(b.x, b.y);
      continue;
    }
    const p1x = a.x + (a.handleOutX ?? 0);
    const p1y = a.y + (a.handleOutY ?? 0);
    const p2x = b.x + (b.handleInX ?? 0);
    const p2y = b.y + (b.handleInY ?? 0);
    for (let s = 1; s <= segments; s += 1) {
      const t = s / segments;
      const mt = 1 - t;
      const x = mt * mt * mt * a.x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * b.x;
      const y = mt * mt * mt * a.y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * b.y;
      pushPoint(x, y);
    }
  }
  // Closed paths end back on the first point; drop the duplicate (callers close explicitly).
  return closed && out.length > 2 ? out.slice(0, -2) : out;
}

/** Document-space feathered selection mask → image-layer mask (luminance → alpha, layer-local). */
async function selectionMaskToLayerMask(
  maskDataUrl: string,
  layer: ImageLayer,
  canvasW: number,
  canvasH: number
): Promise<string> {
  const img = await loadImageElement(maskDataUrl);
  const w = Math.max(1, Math.round(layer.width));
  const h = Math.max(1, Math.round(layer.height));
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create mask canvas');
  ctx.drawImage(img, -layer.x / sx, -layer.y / sy, canvasW / sx, canvasH / sy);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i];
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = lum;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

/** True while playAction runs, so replayed steps are not re-recorded. */
let isPlayingAction = false;

interface EditorState {
  // Canvas State
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;

  // Tools & Settings
  activeTool: ToolType;
  activeShapeType: ShapeType;
  brushSettings: BrushSettings;
  penSettings: PenSettings;
  shapeSettings: ShapeSettings;
  textSettings: TextSettings;
  cropSettings: CropSettings;
  marqueeMode: MarqueeMode;
  wandTolerance: number;

  // Layers
  layers: EditorLayer[];
  selectedLayerId: string | null;
  marqueeSelection: SelectionShape | null;
  setMarqueeSelection: (sel: SelectionShape | null) => void;

  // Gradient & tone brush settings
  gradientSettings: GradientSettings;
  updateGradientSettings: (settings: Partial<GradientSettings>) => void;
  toneBrushSettings: ToneBrushSettings;
  updateToneBrushSettings: (settings: Partial<ToneBrushSettings>) => void;

  // Guides
  guides: Guide[];
  snapToGuides: boolean;
  addGuide: (orientation: Guide['orientation'], position: number) => string;
  removeGuide: (id: string) => void;
  clearGuides: () => void;
  setSnapToGuides: (snap: boolean) => void;

  // Artboards
  artboards: Artboard[];
  activeArtboardId: string | null;
  addArtboard: (artboard?: Partial<Omit<Artboard, 'id'>>) => string;
  setActiveArtboard: (id: string | null) => void;
  updateArtboard: (id: string, updates: Partial<Omit<Artboard, 'id'>>) => void;
  removeArtboard: (id: string) => void;

  // Actions (macro recording)
  actions: EditorAction[];
  isRecordingAction: boolean;
  recordingSteps: EditorActionStep[];
  startRecordingAction: () => void;
  /** Appends a step while recording (no-op otherwise / during playback). */
  recordActionStep: (type: string, label: string, payload?: Record<string, unknown>) => void;
  stopRecordingAction: (name: string) => EditorAction | null;
  playAction: (id: string) => Promise<void>;
  deleteAction: (id: string) => void;

  // Transform
  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;

  // Photoshop-lite feature operations
  addAdjustmentLayer: (kind: AdjustmentLayerKind) => void;
  addGradientLayerFromDrag: (x1: number, y1: number, x2: number, y2: number) => void;
  bakeClassicFilterOnSelected: (
    kind: ClassicFilterKind,
    params?: Record<string, number>
  ) => Promise<void>;
  modifyMarqueeSelection: (
    op: 'invert' | 'expand' | 'contract' | 'feather',
    amount?: number
  ) => Promise<void>;
  /** Stores curves live in adjustments.curves; pass { bake: true } to bake into pixels instead. */
  applyCurvesToSelected: (curves: CurvesAdjustment, options?: { bake?: boolean }) => Promise<void>;
  /** Stores levels live in adjustments.levels; pass { bake: true } to bake into pixels instead. */
  applyLevelsToSelected: (levels: LevelsAdjustment, options?: { bake?: boolean }) => Promise<void>;
  convertSelectedToSmartObject: () => void;
  replaceSmartObjectSource: (src: string, width?: number, height?: number) => void;
  pathToSelection: () => void;
  strokePathAsDrawing: () => void;
  placeGradientFill: (x1: number, y1: number, x2: number, y2: number) => void;


  // History
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // AI & Processing
  aiStatus: AIStatus;
  removeBgApiKey: string;
  replicateApiKey: string;

  // Modals & Panels
  isExportModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isOnboardingOpen: boolean;
  isBeforeAfterOpen: boolean;
  secondaryColor: string;
  isSettingsModalOpen: boolean;
  isNewCanvasModalOpen: boolean;
  isImageSizeModalOpen: boolean;
  isStockModalOpen: boolean;
  isExifModalOpen: boolean;
  lastExif: ImageExifSummary | null;
  /** False until New Document / place image / open project — drives empty-stage overlay */
  isDocumentOpen: boolean;

  // Actions - Canvas & View
  setCanvasDimensions: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  createBlankDocument: (width: number, height: number, backgroundColor: string) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetView: () => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;

  // Actions - Tools
  setActiveTool: (tool: ToolType) => void;
  setActiveShapeType: (shape: ShapeType) => void;
  setMarqueeMode: (mode: MarqueeMode) => void;
  setWandTolerance: (tolerance: number) => void;
  updateBrushSettings: (settings: Partial<BrushSettings>) => void;
  updatePenSettings: (settings: Partial<PenSettings>) => void;
  updateShapeSettings: (settings: Partial<ShapeSettings>) => void;
  updateTextSettings: (settings: Partial<TextSettings>) => void;
  setCropSettings: (settings: Partial<CropSettings>) => void;
  applyCrop: () => Promise<void>;
  cancelCrop: () => void;

  // Actions - Layers
  addLayer: (layer: EditorLayer) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  updateLayer: (id: string, updates: Partial<EditorLayer>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  duplicateLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerBlendMode: (id: string, blendMode: BlendMode) => void;
  setLayerOpacity: (id: string, opacity: number) => void;

  // Actions - Image Enhancements & Presets
  updateAdjustments: (id: string, adjustments: Partial<ImageAdjustments>) => void;
  applyPresetToLayer: (id: string, presetId: string) => void;
  autoEnhanceLayer: (id: string) => Promise<void>;
  revivePhotoLayer: (
    id: string,
    mode?: ReviveMode,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  cleanPhotoLayer: (
    id: string,
    mode?: CleanupMode,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  relightPhotoLayer: (
    id: string,
    mode?: RelightMode,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  polishPortraitLayer: (
    id: string,
    mode?: PortraitMode,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  clarityPhotoLayer: (
    id: string,
    mode?: ClarityMode,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  colorMatchLayer: (
    id: string,
    referenceSrc: string,
    intensity?: number,
    bakeNewLayer?: boolean
  ) => Promise<void>;
  outpaintDocument: (options: {
    preset: OutpaintPreset;
    useCloud?: boolean;
    expandRatio?: number;
  }) => Promise<void>;
  runBatchLab: (options: {
    revive?: boolean;
    cleanup?: boolean;
    cutout?: boolean;
    reviveMode?: ReviveMode;
    cleanupMode?: CleanupMode;
    cutoutProvider?: 'client' | 'remove.bg';
  }) => Promise<void>;

  // Actions - AI Operations
  removeBackground: (id: string, provider?: 'client' | 'remove.bg') => Promise<void>;
  upscaleLayer: (id: string, scaleFactor?: number) => Promise<void>;
  runCloudAiJob: (
    id: string,
    kind: AiJobKind,
    options?: {
      intensity?: number;
      prompt?: string;
      style?: AiStylePreset;
      relight?: AiRelightPreset;
      maskBase64?: string;
    }
  ) => Promise<void>;
  setAIStatus: (status: Partial<AIStatus>) => void;
  lastCaption: string;

  // Actions - Clipping Mask & Layer Mask
  setClippingMask: (id: string, clipToId: string) => void;
  removeClippingMask: (id: string) => void;
  toggleLayerMask: (id: string) => void;
  paintLayerMask: (id: string, maskDataUrl: string) => void;

  // Actions - Layer Generators
  addImageLayer: (src: string, name?: string, naturalWidth?: number, naturalHeight?: number) => void;
  addTextLayer: (position?: { x: number; y: number }) => void;
  addShapeLayer: (type?: ShapeType) => void;
  addPathLayer: (anchors: PathAnchor[], closed?: boolean) => void;
  addDrawingStroke: (layerId: string, stroke: { points: number[]; color: string; size: number; opacity: number; isEraser: boolean }) => void;

  // Actions - History
  commitHistory: (actionName: string) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistoryStep: (snapshotId: string) => void;

  // Modals
  setExportModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setNewCanvasModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;
  setImageSizeModalOpen: (open: boolean) => void;
  setStockModalOpen: (open: boolean) => void;
  setExifModalOpen: (open: boolean) => void;
  inspectSelectedExif: () => Promise<void>;
  compressSelectedImage: (options?: {
    maxEdge?: number;
    quality?: number;
    format?: CompressFormat;
  }) => Promise<void>;
  colorizeSelectedImage: (preset?: ColorizePreset, intensity?: number) => Promise<void>;
  resizeImageLayer: (
    id: string,
    options: {
      width: number;
      height: number;
      format?: 'image/jpeg' | 'image/webp' | 'image/png' | 'image/avif';
      quality?: number;
      resizeCanvas?: boolean;
    }
  ) => Promise<void>;
  setBeforeAfterOpen: (open: boolean) => void;
  setSecondaryColor: (color: string) => void;
  swapBrushColors: () => void;
  resetBrushColors: () => void;
  nudgeSelectedLayer: (dx: number, dy: number) => void;
  setApiKeys: (keys: { removeBgApiKey?: string; replicateApiKey?: string }) => void;

  // Project I/O
  projectTitle: string;
  cloudProjectId: string | null;
  setProjectTitle: (title: string) => void;
  saveProject: () => void;
  loadProject: (project: ProjectFileData) => void;
  saveProjectToCloud: () => Promise<ProjectSummaryDto>;
  listCloudProjects: () => Promise<ProjectSummaryDto[]>;
  loadProjectFromCloud: (id: string) => Promise<void>;
}

const MAX_HISTORY = 40;

export const useEditorStore = create<EditorState>((set, get) => ({
  canvasWidth: 1200,
  canvasHeight: 800,
  backgroundColor: 'transparent',
  zoom: 1,
  pan: { x: 0, y: 0 },
  showGrid: false,
  showRulers: true,

  activeTool: 'select',
  activeShapeType: 'rectangle',
  marqueeMode: 'rect',
  wandTolerance: 36,
  brushSettings: {
    size: 24,
    color: '#d4923a',
    opacity: 1,
    hardness: 0.8,
    flow: 1,
    refineMode: 'erase',
  },
  penSettings: { ...DEFAULT_PEN_SETTINGS },
  shapeSettings: { ...DEFAULT_SHAPE_SETTINGS },
  textSettings: { ...DEFAULT_TEXT_SETTINGS },
  cropSettings: {
    active: false,
    aspect: 'free',
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    rotation: 0,
  },

  layers: [],
  selectedLayerId: null,
  marqueeSelection: null,

  setMarqueeSelection: (sel) => set({ marqueeSelection: sel }),

  gradientSettings: deepClone(DEFAULT_GRADIENT_SETTINGS),
  toneBrushSettings: { ...DEFAULT_TONE_BRUSH },
  guides: [],
  snapToGuides: true,
  artboards: [],
  activeArtboardId: null,
  actions: [],
  isRecordingAction: false,
  recordingSteps: [],
  transformMode: 'free',

  past: [],
  future: [],

  aiStatus: {
    isProcessing: false,
    action: null,
    progress: 0,
    statusText: '',
  },
  removeBgApiKey: localStorage.getItem('px_remove_bg_key') || '',
  replicateApiKey: localStorage.getItem('px_replicate_key') || '',

  isExportModalOpen: false,
  isImageSizeModalOpen: false,
  isStockModalOpen: false,
  isExifModalOpen: false,
  lastExif: null,
  isShortcutsModalOpen: false,
  isOnboardingOpen: false,
  isBeforeAfterOpen: false,
  secondaryColor: '#ece8e1',
  isSettingsModalOpen: false,
  isNewCanvasModalOpen: false,
  isDocumentOpen: false,
  projectTitle: 'Untitled',
  cloudProjectId: null,
  lastCaption: '',

  setCanvasDimensions: (width, height) => {
    get().commitHistory(`Resize Canvas to ${width}x${height}`);
    set({ canvasWidth: width, canvasHeight: height });
  },

  setBackgroundColor: (color) => {
    get().commitHistory('Change Background Color');
    set({ backgroundColor: color });
  },

  createBlankDocument: (width, height, backgroundColor) => {
    const w = Math.max(50, Math.min(8000, Math.round(width) || 1200));
    const h = Math.max(50, Math.min(8000, Math.round(height) || 800));
    set({
      canvasWidth: w,
      canvasHeight: h,
      backgroundColor,
      layers: [],
      selectedLayerId: null,
      marqueeSelection: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      isDocumentOpen: true,
      isNewCanvasModalOpen: false,
      projectTitle: 'Untitled',
      cloudProjectId: null,
      activeTool: 'select',
      aiStatus: {
        isProcessing: false,
        action: null,
        progress: 0,
        statusText: '',
      },
    });
  },

  setZoom: (zoom) => {
    set((state) => ({
      zoom: typeof zoom === 'function' ? Math.max(0.1, Math.min(8, zoom(state.zoom))) : Math.max(0.1, Math.min(8, zoom)),
    }));
  },

  setPan: (pan) => {
    set((state) => ({
      pan: typeof pan === 'function' ? pan(state.pan) : pan,
    }));
  },

  resetView: () => {
    set({ zoom: 1, pan: { x: 0, y: 0 } });
  },

  fitToScreen: (containerWidth, containerHeight) => {
    const { canvasWidth, canvasHeight } = get();
    const padding = 60;
    const availW = Math.max(100, containerWidth - padding * 2);
    const availH = Math.max(100, containerHeight - padding * 2);
    const scale = Math.min(availW / canvasWidth, availH / canvasHeight, 1.5);
    const safeScale = Math.max(0.1, Number(scale.toFixed(2)));

    const panX = Math.round((containerWidth - canvasWidth * safeScale) / 2);
    const panY = Math.round((containerHeight - canvasHeight * safeScale) / 2);

    set({ zoom: safeScale, pan: { x: panX, y: panY } });
  },

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),

  setActiveTool: (tool) => {
    if (tool === 'crop') {
      const { canvasWidth, canvasHeight, selectedLayerId, layers } = get();
      const selected = layers.find((l) => l.id === selectedLayerId);
      // Prefer the selected image bounds so crop feels like “crop this photo”
      if (selected?.type === 'image') {
        const w = Math.max(20, Math.round(selected.width * Math.abs(selected.scaleX)));
        const h = Math.max(20, Math.round(selected.height * Math.abs(selected.scaleY)));
        const x = Math.round(
          Math.max(0, Math.min(selected.x, canvasWidth - Math.min(w, canvasWidth)))
        );
        const y = Math.round(
          Math.max(0, Math.min(selected.y, canvasHeight - Math.min(h, canvasHeight)))
        );
        set({
          activeTool: 'crop',
          cropSettings: {
            active: true,
            aspect: 'free',
            x,
            y,
            width: Math.min(w, canvasWidth - x),
            height: Math.min(h, canvasHeight - y),
            rotation: 0,
          },
        });
      } else {
        set({
          activeTool: 'crop',
          cropSettings: {
            active: true,
            aspect: 'free',
            x: Math.round(canvasWidth * 0.05),
            y: Math.round(canvasHeight * 0.05),
            width: Math.round(canvasWidth * 0.9),
            height: Math.round(canvasHeight * 0.9),
            rotation: 0,
          },
        });
      }
    } else {
      set({
        activeTool: tool,
        cropSettings: { ...get().cropSettings, active: false },
      });
    }
  },

  setActiveShapeType: (shape) => set({ activeShapeType: shape }),

  setMarqueeMode: (mode) => set({ marqueeMode: mode }),

  setWandTolerance: (tolerance) =>
    set({ wandTolerance: Math.max(0, Math.min(128, tolerance)) }),

  updateBrushSettings: (settings) =>
    set((state) => ({ brushSettings: { ...state.brushSettings, ...settings } })),

  updatePenSettings: (settings) =>
    set((state) => ({ penSettings: { ...state.penSettings, ...settings } })),

  updateShapeSettings: (settings) =>
    set((state) => ({ shapeSettings: { ...state.shapeSettings, ...settings } })),

  updateTextSettings: (settings) =>
    set((state) => ({ textSettings: { ...state.textSettings, ...settings } })),

  setCropSettings: (settings) =>
    set((state) => ({ cropSettings: { ...state.cropSettings, ...settings } })),

  applyCrop: async () => {
    const { cropSettings, layers } = get();
    if (!cropSettings.active) return;

    const crop = {
      x: cropSettings.x,
      y: cropSettings.y,
      width: Math.max(1, cropSettings.width),
      height: Math.max(1, cropSettings.height),
    };

    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 35,
        statusText: 'Cropping images…',
      },
    });

    try {
      get().commitHistory('Crop');

      const updatedLayers = await Promise.all(
        layers.map(async (layer) => {
          if (layer.type === 'image') {
            return applyCropToImageLayer(layer, crop);
          }
          return {
            ...layer,
            x: layer.x - crop.x,
            y: layer.y - crop.y,
          };
        })
      );

      set({
        canvasWidth: Math.max(50, Math.round(crop.width)),
        canvasHeight: Math.max(50, Math.round(crop.height)),
        layers: updatedLayers,
        activeTool: 'select',
        cropSettings: { ...cropSettings, active: false },
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Cropped to ${Math.round(crop.width)}×${Math.round(crop.height)}`,
        },
      });
    } catch (err) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: getErrorMessage(err),
        },
      });
    }
  },

  cancelCrop: () => {
    set((state) => ({
      activeTool: 'select',
      cropSettings: { ...state.cropSettings, active: false },
    }));
  },

  commitHistory: (actionName) => {
    const { layers, canvasWidth, canvasHeight, backgroundColor, past } = get();
    const snapshotLayers = deepClone(layers);

    const newSnapshot: HistorySnapshot = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: actionName,
      timestamp: Date.now(),
      layers: snapshotLayers,
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), newSnapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'Current State',
      timestamp: Date.now(),
      layers: deepClone(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      layers: previous.layers,
      canvasWidth: previous.canvasWidth,
      canvasHeight: previous.canvasHeight,
      backgroundColor: previous.backgroundColor,
      past: newPast,
      future: [currentSnapshot, ...future],
      selectedLayerId: previous.layers.length > 0 ? previous.layers[previous.layers.length - 1].id : null,
    });
  },

  redo: () => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'Current State',
      timestamp: Date.now(),
      layers: deepClone(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      layers: next.layers,
      canvasWidth: next.canvasWidth,
      canvasHeight: next.canvasHeight,
      backgroundColor: next.backgroundColor,
      past: [...past, currentSnapshot],
      future: newFuture,
      selectedLayerId: next.layers.length > 0 ? next.layers[next.layers.length - 1].id : null,
    });
  },

  jumpToHistoryStep: (snapshotId) => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    const index = past.findIndex((s) => s.id === snapshotId);
    if (index === -1) return;

    const target = past[index];
    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'State before jump',
      timestamp: Date.now(),
      layers: deepClone(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    const newPast = past.slice(0, index);
    const movedToFuture = [...past.slice(index + 1), currentSnapshot, ...future];

    set({
      layers: target.layers,
      canvasWidth: target.canvasWidth,
      canvasHeight: target.canvasHeight,
      backgroundColor: target.backgroundColor,
      past: newPast,
      future: movedToFuture,
      selectedLayerId: target.layers.length > 0 ? target.layers[target.layers.length - 1].id : null,
    });
  },

  addLayer: (layer) => {
    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
    }));
  },

  removeLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;

    get().commitHistory(`Delete ${layer.name}`);
    set((state) => {
      const newLayers = state.layers.filter((l) => l.id !== id);
      return {
        layers: newLayers,
        selectedLayerId:
          state.selectedLayerId === id
            ? newLayers.length > 0
              ? newLayers[newLayers.length - 1].id
              : null
            : state.selectedLayerId,
      };
    });
  },

  selectLayer: (id) => set({ selectedLayerId: id }),

  updateLayer: (id, updates) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? ({ ...l, ...updates } as EditorLayer) : l)),
    }));
  },

  reorderLayers: (fromIndex, toIndex) => {
    const { layers } = get();
    if (fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length) return;

    get().commitHistory('Reorder Layers');
    const newLayers = [...layers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);

    set({ layers: newLayers });
  },

  duplicateLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;

    get().commitHistory(`Duplicate ${layer.name}`);
    const duplicated: EditorLayer = {
      ...deepClone(layer),
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(`${layer.name} Copy`, get().layers),
      x: layer.x + 25,
      y: layer.y + 25,
    };

    set((state) => ({
      layers: [...state.layers, duplicated],
      selectedLayerId: duplicated.id,
    }));
  },

  toggleLayerVisibility: (id) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    }));
  },

  toggleLayerLock: (id) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    }));
  },

  renameLayer: (id, name) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    }));
  },

  setLayerBlendMode: (id, blendMode) => {
    get().commitHistory('Change Blend Mode');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)),
    }));
  },

  setLayerOpacity: (id, opacity) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
    }));
  },

  updateAdjustments: (id, adjustments) => {
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id === id && (layer.type === 'image' || layer.type === 'adjustment')) {
          return {
            ...layer,
            adjustments: {
              ...layer.adjustments,
              ...adjustments,
            },
          };
        }
        return layer;
      }),
    }));
  },

  applyPresetToLayer: (id, presetId) => {
    const preset = FILTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    get().commitHistory(`Apply Preset: ${preset.name}`);
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id === id && layer.type === 'image') {
          return {
            ...layer,
            preset: preset.name,
            adjustments: {
              ...DEFAULT_ADJUSTMENTS,
              ...preset.adjustments,
            },
          };
        }
        return layer;
      }),
    }));
  },

  autoEnhanceLayer: async (id) => {
    await get().revivePhotoLayer(id, 'natural', 0.8, false);
  },

  revivePhotoLayer: async (id, mode = 'natural', intensity = 0.75, bakeNewLayer = false) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;

    get().recordActionStep('revive', `Revive · ${mode}`, { mode, intensity, bakeNewLayer });
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

    set({
      aiStatus: {
        isProcessing: true,
        action: 'revive',
        progress: 20,
        statusText: `Analyzing photo for ${modeLabel} revive...`,
        error: undefined,
      },
    });

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = layer.src;
      });

      set({
        aiStatus: {
          isProcessing: true,
          action: 'revive',
          progress: 55,
          statusText: bakeNewLayer
            ? 'Baking pixel revive (levels · cast · clarity)...'
            : 'Tuning exposure, cast & vibrance...',
        },
      });

      if (bakeNewLayer) {
        const bakedSrc = await bakeRevivePixels(layer.src, mode, intensity);
        const adjustments = computeReviveAdjustments(img, mode, intensity * 0.45);

        get().commitHistory(`Photo Revive · ${modeLabel}`);

        const revived: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_revived`,
          name: derivativeName(layer.name, 'Revived', get().layers),
          src: bakedSrc,
          originalSrc: layer.originalSrc || layer.src,
          preset: `Revive ${modeLabel}`,
          adjustments,
        };

        set((state) => ({
          layers: [...state.layers, revived],
          selectedLayerId: revived.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Revived as new layer (${modeLabel})`,
          },
        }));
      } else {
        const enhancements = computeReviveAdjustments(img, mode, intensity);
        get().commitHistory(`Photo Revive · ${modeLabel}`);

        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  preset: `Revive ${modeLabel}`,
                  adjustments: enhancements,
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Photo revived · ${modeLabel}`,
          },
        }));
      }
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Revive failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
    }
  },

  cleanPhotoLayer: async (id, mode = 'standard', intensity = 0.7, bakeNewLayer = true) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;

    get().recordActionStep('cleanup', `Cleanup · ${mode}`, { mode, intensity, bakeNewLayer });
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

    set({
      aiStatus: {
        isProcessing: true,
        action: 'cleanup',
        progress: 15,
        statusText: `Cleaning photo · ${modeLabel}...`,
        error: undefined,
      },
    });

    try {
      set({
        aiStatus: {
          isProcessing: true,
          action: 'cleanup',
          progress: 45,
          statusText: 'Denoising & removing speckles...',
        },
      });

      const cleanedSrc = await bakeCleanupPixels(layer.src, mode, intensity);

      set({
        aiStatus: {
          isProcessing: true,
          action: 'cleanup',
          progress: 85,
          statusText: 'Restoring edge detail...',
        },
      });

      get().commitHistory(`Photo Cleanup · ${modeLabel}`);

      if (bakeNewLayer) {
        const cleaned: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_cleaned`,
          name: derivativeName(layer.name, 'Cleaned', get().layers),
          src: cleanedSrc,
          originalSrc: layer.originalSrc || layer.src,
          preset: `Cleanup ${modeLabel}`,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };

        set((state) => ({
          layers: [...state.layers, cleaned],
          selectedLayerId: cleaned.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Photo cleaned · ${modeLabel}`,
          },
        }));
      } else {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  src: cleanedSrc,
                  preset: `Cleanup ${modeLabel}`,
                  adjustments: { ...DEFAULT_ADJUSTMENTS },
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Photo cleaned · ${modeLabel}`,
          },
        }));
      }
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Cleanup failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
    }
  },

  relightPhotoLayer: async (id, mode = 'softbox', intensity = 0.7, bakeNewLayer = true) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;

    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

    set({
      aiStatus: {
        isProcessing: true,
        action: 'relight',
        progress: 20,
        statusText: `Relight · ${modeLabel}...`,
        error: undefined,
      },
    });

    try {
      const litSrc = await bakeRelightPixels(layer.src, mode, intensity);
      get().commitHistory(`Relight · ${modeLabel}`);

      if (bakeNewLayer) {
        const lit: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_relight`,
          name: derivativeName(layer.name, 'Relight', get().layers),
          src: litSrc,
          originalSrc: layer.originalSrc || layer.src,
          preset: `Relight ${modeLabel}`,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        set((state) => ({
          layers: [...state.layers, lit],
          selectedLayerId: lit.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Relight applied · ${modeLabel}`,
          },
        }));
      } else {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  src: litSrc,
                  preset: `Relight ${modeLabel}`,
                  adjustments: { ...DEFAULT_ADJUSTMENTS },
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Relight applied · ${modeLabel}`,
          },
        }));
      }
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Relight failed'),
        },
      });
    }
  },

  polishPortraitLayer: async (id, mode = 'natural', intensity = 0.65, bakeNewLayer = true) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;

    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

    set({
      aiStatus: {
        isProcessing: true,
        action: 'portrait-polish',
        progress: 20,
        statusText: `Portrait polish · ${modeLabel}...`,
        error: undefined,
      },
    });

    try {
      const polishedSrc = await bakePortraitPixels(layer.src, mode, intensity);
      get().commitHistory(`Portrait · ${modeLabel}`);

      if (bakeNewLayer) {
        const polished: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_portrait`,
          name: derivativeName(layer.name, 'Portrait', get().layers),
          src: polishedSrc,
          originalSrc: layer.originalSrc || layer.src,
          preset: `Portrait ${modeLabel}`,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        set((state) => ({
          layers: [...state.layers, polished],
          selectedLayerId: polished.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Portrait polished · ${modeLabel}`,
          },
        }));
      } else {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  src: polishedSrc,
                  preset: `Portrait ${modeLabel}`,
                  adjustments: { ...DEFAULT_ADJUSTMENTS },
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `Portrait polished · ${modeLabel}`,
          },
        }));
      }
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Portrait polish failed'),
        },
      });
    }
  },

  clarityPhotoLayer: async (id, mode = 'clarity', intensity = 0.7, bakeNewLayer = true) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

    set({
      aiStatus: {
        isProcessing: true,
        action: 'clarity',
        progress: 25,
        statusText: `${modeLabel}…`,
        error: undefined,
      },
    });

    try {
      const nextSrc = await bakeClarityPixels(layer.src, mode, intensity);
      get().commitHistory(`${modeLabel}`);

      if (bakeNewLayer) {
        const next: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_clarity`,
          name: derivativeName(layer.name, modeLabel, get().layers),
          src: nextSrc,
          originalSrc: layer.originalSrc || layer.src,
          preset: modeLabel,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        set((state) => ({
          layers: [...state.layers, next],
          selectedLayerId: next.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `${modeLabel} applied`,
          },
        }));
      } else {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  src: nextSrc,
                  preset: modeLabel,
                  adjustments: { ...DEFAULT_ADJUSTMENTS },
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: `${modeLabel} applied`,
          },
        }));
      }
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Clarity failed'),
        },
      });
    }
  },

  colorMatchLayer: async (id, referenceSrc, intensity = 0.8, bakeNewLayer = true) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;
    if (!referenceSrc) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Choose a reference photo first',
        },
      });
      return;
    }

    set({
      aiStatus: {
        isProcessing: true,
        action: 'color-match',
        progress: 20,
        statusText: 'Matching grade from reference…',
        error: undefined,
      },
    });

    try {
      const matched = await bakeColorMatchPixels(layer.src, referenceSrc, intensity);
      get().commitHistory('Color Match');

      if (bakeNewLayer) {
        const next: ImageLayer = {
          ...deepClone(layer),
          id: `${Date.now()}_grade`,
          name: derivativeName(layer.name, 'Grade', get().layers),
          src: matched,
          originalSrc: layer.originalSrc || layer.src,
          preset: 'Color Match',
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        };
        set((state) => ({
          layers: [...state.layers, next],
          selectedLayerId: next.id,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: 'Color match applied',
          },
        }));
      } else {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id && l.type === 'image'
              ? {
                  ...l,
                  src: matched,
                  preset: 'Color Match',
                  adjustments: { ...DEFAULT_ADJUSTMENTS },
                }
              : l
          ),
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: 'Color match applied',
          },
        }));
      }
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Color match failed'),
        },
      });
    }
  },

  outpaintDocument: async ({ preset, useCloud = false, expandRatio = 0.15 }) => {
    const { canvasWidth, canvasHeight, layers, selectedLayerId } = get();
    const layout = computeOutpaintLayout(canvasWidth, canvasHeight, preset, expandRatio);

    if (layout.width === canvasWidth && layout.height === canvasHeight) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Canvas already matches that aspect — try Expand +15%',
        },
      });
      return;
    }

    set({
      aiStatus: {
        isProcessing: true,
        action: 'outpaint',
        progress: 15,
        statusText: useCloud ? 'Expanding + cloud outpaint…' : 'Expanding canvas…',
        error: undefined,
      },
    });

    try {
      get().commitHistory(`Outpaint · ${preset}`);

      const imageId =
        selectedLayerId && layers.find((l) => l.id === selectedLayerId)?.type === 'image'
          ? selectedLayerId
          : layers.slice().reverse().find((l) => l.type === 'image')?.id;

      let updatedLayers = layers.map((layer) => ({
        ...layer,
        x: layer.x + layout.offsetX,
        y: layer.y + layout.offsetY,
      }));

      const padL = layout.offsetX;
      const padT = layout.offsetY;
      const padR = layout.width - layout.offsetX - canvasWidth;
      const padB = layout.height - layout.offsetY - canvasHeight;

      if (imageId) {
        const imgLayer = updatedLayers.find((l) => l.id === imageId);
        if (imgLayer && imgLayer.type === 'image') {
          set({
            aiStatus: {
              isProcessing: true,
              action: 'outpaint',
              progress: 40,
              statusText: 'Filling new edges…',
            },
          });

          // Flatten to old document size, then pad into the new frame
          const flat = await rasterizeImageToSize(imgLayer.src, canvasWidth, canvasHeight);
          const expanded = await expandImageWithEdgeFill(flat, padL, padT, padR, padB);
          let finalSrc = expanded.src;

          if (useCloud) {
            set({
              aiStatus: {
                isProcessing: true,
                action: 'outpaint',
                progress: 55,
                statusText: 'Cloud outpaint…',
              },
            });
            const maskBase64 = await buildOutpaintBorderMask(
              expanded.width,
              expanded.height,
              padL,
              padT,
              canvasWidth,
              canvasHeight
            );
            const apiKey = get().replicateApiKey || undefined;
            const started = await aiApiClient.outpaint({
              imageBase64: finalSrc,
              maskBase64,
              apiKey,
            });
            if (started.fallbackToClient) {
              throw new Error(started.message || 'Cloud outpaint unavailable');
            }
            let resultSrc = started.imageBase64 || '';
            if (started.predictionId || started.statusUrl) {
              const poll = await aiApiClient.pollUntilComplete({
                predictionId: started.predictionId,
                statusUrl: started.statusUrl,
                apiKey,
              });
              resultSrc = poll.imageBase64 || resultSrc;
            }
            if (!resultSrc) throw new Error('Outpaint returned no image');
            finalSrc = resultSrc;
          }

          updatedLayers = updatedLayers.map((l) =>
            l.id === imageId && l.type === 'image'
              ? {
                  ...l,
                  src: finalSrc,
                  originalSrc: l.originalSrc || l.src,
                  x: 0,
                  y: 0,
                  width: expanded.width,
                  height: expanded.height,
                  scaleX: 1,
                  scaleY: 1,
                  rotation: 0,
                }
              : l
          );
        }
      }

      set({
        canvasWidth: layout.width,
        canvasHeight: layout.height,
        layers: updatedLayers,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Outpainted to ${layout.width}×${layout.height}`,
        },
      });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Outpaint failed'),
        },
      });
    }
  },

  runBatchLab: async ({
    revive = false,
    cleanup = false,
    cutout = false,
    reviveMode = 'natural',
    cleanupMode = 'standard',
    cutoutProvider = 'client',
  }) => {
    if (!revive && !cleanup && !cutout) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Pick at least one batch recipe',
        },
      });
      return;
    }

    const imageIds = get()
      .layers.filter((l) => l.type === 'image')
      .map((l) => l.id);

    if (!imageIds.length) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'No image layers to batch',
        },
      });
      return;
    }

    set({
      aiStatus: {
        isProcessing: true,
        action: 'batch',
        progress: 5,
        statusText: `Batch Lab · ${imageIds.length} layers…`,
        error: undefined,
      },
    });

    try {
      for (let i = 0; i < imageIds.length; i++) {
        const id = imageIds[i];
        const pct = Math.round(((i + 0.3) / imageIds.length) * 100);
        set({
          aiStatus: {
            isProcessing: true,
            action: 'batch',
            progress: Math.min(95, pct),
            statusText: `Batch ${i + 1}/${imageIds.length}…`,
          },
        });

        if (revive) {
          await get().revivePhotoLayer(id, reviveMode, 0.75, false);
        }
        if (cleanup) {
          await get().cleanPhotoLayer(id, cleanupMode, 0.7, false);
        }
        if (cutout) {
          await get().removeBackground(id, cutoutProvider);
        }
      }

      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Batch done · ${imageIds.length} layers`,
        },
      });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Batch Lab failed'),
        },
      });
    }
  },

  removeBackground: async (id, provider = 'client') => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Please select an image layer first',
        },
      });
      return;
    }

    set({
      aiStatus: {
        isProcessing: true,
        action: 'remove-bg',
        progress: 10,
        statusText: 'Starting background removal...',
        error: undefined,
      },
    });

    try {
      const removeBgKey = get().removeBgApiKey;

      const result = await executeBackgroundRemoval(layer.src, {
        provider,
        apiKey: removeBgKey,
        onProgress: (progress, statusText) => {
          set((state) => ({
            aiStatus: {
              ...state.aiStatus,
              isProcessing: true,
              action: 'remove-bg',
              progress,
              statusText,
            },
          }));
        },
      });

      get().commitHistory('Remove Background');

      // Create new transparent PNG layer
      const transparentLayer: ImageLayer = {
        ...deepClone(layer),
        id: `${Date.now()}_nobg_${Math.random().toString(36).substring(2, 6)}`,
        name: derivativeName(layer.name, 'Cutout', get().layers),
        src: result.dataUrl,
        maskDataUrl: result.dataUrl,
        x: layer.x + 20,
        y: layer.y + 20,
      };

      set((state) => ({
        layers: [...state.layers, transparentLayer],
        selectedLayerId: transparentLayer.id,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText:
            result.methodUsed === 'remove.bg'
              ? 'Background removed via remove.bg!'
              : result.methodUsed === 'neural-wasm'
              ? 'Background removed via AI Neural Model!'
              : 'Background removed via Smart Boundary Segmentation!',
        },
      }));
    } catch (e: unknown) {
      console.error('removeBackground error:', e);
      const err = getErrorMessage(e, 'Background removal failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
    }
  },

  upscaleLayer: async (id, scaleFactor = 2) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;

    set({
      aiStatus: {
        isProcessing: true,
        action: 'upscale',
        progress: 20,
        statusText: `Upscaling ${scaleFactor}x & recovering details...`,
      },
    });

    try {
      const replicateKey = get().replicateApiKey || undefined;
      let upscaledSrc = '';

      // Prefer server proxy (env token on API); optional client key override
      set({
        aiStatus: {
          isProcessing: true,
          action: 'upscale',
          progress: 40,
          statusText: 'Submitting upscale job...',
        },
      });

      try {
        const data = await aiApiClient.upscale({
          imageBase64: layer.src,
          apiKey: replicateKey,
          scale: scaleFactor,
        });

        if (data.fallbackToClient) {
          throw new Error(data.message || 'Server has no Replicate token');
        }

        if (data.statusUrl || data.predictionId) {
          const poll = await aiApiClient.pollUntilComplete(
            {
              statusUrl: data.statusUrl,
              predictionId: data.predictionId,
              apiKey: replicateKey,
            },
            {
              onProgress: (attempt, status) => {
                set({
                  aiStatus: {
                    isProcessing: true,
                    action: 'upscale',
                    progress: Math.min(90, 55 + attempt),
                    statusText: `Upscale ${status}...`,
                  },
                });
              },
            }
          );
          upscaledSrc = poll.imageBase64 || '';
        } else if (data.imageBase64) {
          upscaledSrc = data.imageBase64;
        }
      } catch (apiErr) {
        console.warn('Cloud upscale failed, falling back to client:', getErrorMessage(apiErr));
      }

      if (!upscaledSrc) {
        upscaledSrc = await clientSideSuperResolution(layer.src, scaleFactor);
      }

      get().commitHistory(`AI Upscale ${scaleFactor}x`);

      const upscaledLayer: ImageLayer = {
        ...deepClone(layer),
        id: `${Date.now()}_upscaled`,
        name: derivativeName(layer.name, `${scaleFactor}× Upscale`, get().layers),
        src: upscaledSrc,
        width: Math.round(layer.width * scaleFactor),
        height: Math.round(layer.height * scaleFactor),
      };

      set((state) => ({
        layers: [...state.layers, upscaledLayer],
        selectedLayerId: upscaledLayer.id,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: 'Upscaled successfully!',
        },
      }));
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Upscaling failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
    }
  },

  runCloudAiJob: async (id, kind, options = {}) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Select an image layer first',
        },
      });
      return;
    }

    const actionLabel: Record<AiJobKind, string> = {
      revive: 'Cloud Revive',
      cleanup: 'Cloud Cleanup',
      inpaint: 'Inpaint',
      'object-remove': 'Object Remove',
      outpaint: 'Outpaint',
      'face-restore': 'Face Restore',
      style: 'Style Transfer',
      relight: 'Cloud Relight',
      segment: 'Segmentation',
      caption: 'Caption',
    };

    set({
      aiStatus: {
        isProcessing: true,
        action: kind,
        progress: 15,
        statusText: `${actionLabel[kind]}…`,
        error: undefined,
      },
    });

    try {
      const apiKey = get().replicateApiKey || undefined;
      let maskBase64: string | undefined;

      if (kind === 'inpaint' || kind === 'object-remove') {
        const sel = get().marqueeSelection;
        if (!sel) {
          throw new Error(
            kind === 'object-remove'
              ? 'Select the object to remove (marquee or lasso) first'
              : 'Draw a marquee/lasso selection for inpaint first'
          );
        }
        maskBase64 = await selectionToMaskDataUrl({
          canvasWidth: get().canvasWidth,
          canvasHeight: get().canvasHeight,
          selection: sel,
        });
      } else if (kind === 'outpaint') {
        if (!options.maskBase64) {
          throw new Error('Outpaint needs a border mask — use Lab → Outpaint');
        }
        maskBase64 = options.maskBase64;
      }

      const jobBody = {
        imageBase64: layer.src,
        apiKey,
        intensity: options.intensity ?? 0.7,
        prompt: options.prompt,
        style: options.style,
        relight: options.relight,
        maskBase64,
      };

      const starters: Record<AiJobKind, () => ReturnType<typeof aiApiClient.cleanup>> = {
        cleanup: () => aiApiClient.cleanup(jobBody),
        revive: () => aiApiClient.revive(jobBody),
        inpaint: () => aiApiClient.inpaint(jobBody),
        'object-remove': () => aiApiClient.objectRemove(jobBody),
        outpaint: () => aiApiClient.outpaint(jobBody),
        'face-restore': () => aiApiClient.faceRestore(jobBody),
        style: () => aiApiClient.style(jobBody),
        relight: () => aiApiClient.relight(jobBody),
        segment: () => aiApiClient.segment(jobBody),
        caption: () => aiApiClient.caption(jobBody),
      };

      const started = await starters[kind]();
      if (started.fallbackToClient) {
        // Prefer local pipelines so Lab still works without Replicate
        if (kind === 'revive') {
          await get().revivePhotoLayer(id, 'natural', options.intensity ?? 0.75, true);
          set({
            aiStatus: {
              isProcessing: false,
              action: null,
              progress: 100,
              statusText: 'Local revive (no Replicate token)',
            },
          });
          return;
        }
        if (kind === 'cleanup') {
          await get().cleanPhotoLayer(id, 'standard', options.intensity ?? 0.7, true);
          set({
            aiStatus: {
              isProcessing: false,
              action: null,
              progress: 100,
              statusText: 'Local cleanup (no Replicate token)',
            },
          });
          return;
        }
        if (kind === 'relight') {
          const mode = (options.relight ?? 'softbox') as RelightMode;
          await get().relightPhotoLayer(id, mode, options.intensity ?? 0.7, true);
          set({
            aiStatus: {
              isProcessing: false,
              action: null,
              progress: 100,
              statusText: 'Local relight (no Replicate token)',
            },
          });
          return;
        }
        throw new Error(
          `${actionLabel[kind]} needs Replicate. Set REPLICATE_API_TOKEN in .env or paste an r8_ key in Lab → Keys. Local Revive / Clean / Relight / Cutout / Upscale still work offline.`
        );
      }

      let resultSrc = started.imageBase64 || '';
      let resultText = started.text || '';

      if (started.predictionId || started.statusUrl) {
        const poll = await aiApiClient.pollUntilComplete(
          {
            predictionId: started.predictionId,
            statusUrl: started.statusUrl,
            apiKey,
          },
          {
            onProgress: (attempt, status) => {
              set({
                aiStatus: {
                  isProcessing: true,
                  action: kind,
                  progress: Math.min(92, 25 + attempt),
                  statusText: `${actionLabel[kind]} · ${status}`,
                },
              });
            },
          }
        );
        resultSrc = poll.imageBase64 || resultSrc;
        resultText = poll.text || resultText;
      }

      if (kind === 'caption') {
        set({
          lastCaption: resultText || 'No caption returned',
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: resultText ? `Caption: ${resultText}` : 'Caption done',
          },
        });
        return;
      }

      if (!resultSrc) {
        throw new Error('Cloud job returned no image');
      }

      get().commitHistory(actionLabel[kind]);
      const baked: ImageLayer = {
        ...deepClone(layer),
        id: `${Date.now()}_${kind}`,
        name: derivativeName(layer.name, actionLabel[kind], get().layers),
        src: resultSrc,
        originalSrc: layer.originalSrc || layer.src,
      };

      set((state) => ({
        layers: [...state.layers, baked],
        selectedLayerId: baked.id,
        marqueeSelection:
          kind === 'inpaint' || kind === 'object-remove' ? null : state.marqueeSelection,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `${actionLabel[kind]} complete`,
        },
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, `${kind} failed`),
        },
      });
    }
  },

  setAIStatus: (status) =>
    set((state) => ({ aiStatus: { ...state.aiStatus, ...status } })),

  addImageLayer: (src, name = 'Image Layer', naturalWidth, naturalHeight) => {
    const state = get();
    let { canvasWidth, canvasHeight } = state;
    const w = Math.max(1, Math.round(naturalWidth || 600));
    const h = Math.max(1, Math.round(naturalHeight || 400));

    let targetW = w;
    let targetH = h;
    let x = 0;
    let y = 0;

    // First image opens as the document (supports large photos)
    if (state.layers.length === 0) {
      canvasWidth = w;
      canvasHeight = h;
      targetW = w;
      targetH = h;
      x = 0;
      y = 0;
      set({ canvasWidth, canvasHeight });
    } else {
      // Additional images fit inside the current canvas
      const maxAllowedW = canvasWidth * 0.85;
      const maxAllowedH = canvasHeight * 0.85;
      if (targetW > maxAllowedW || targetH > maxAllowedH) {
        const scale = Math.min(maxAllowedW / targetW, maxAllowedH / targetH);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }
      x = Math.round((canvasWidth - targetW) / 2);
      y = Math.round((canvasHeight - targetH) / 2);
    }

    const newLayer: ImageLayer = {
      id: `${Date.now()}_img_${Math.random().toString(36).substring(2, 6)}`,
      name,
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width: targetW,
      height: targetH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      src,
      originalSrc: src,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };

    get().commitHistory(`Add ${name}`);
    set((s) => ({
      layers: [...s.layers, newLayer],
      selectedLayerId: newLayer.id,
      isDocumentOpen: true,
    }));
  },

  addTextLayer: (position) => {
    const { canvasWidth, canvasHeight, textSettings } = get();
    const width = 240;
    const height = Math.max(40, Math.round(textSettings.fontSize * textSettings.lineHeight * 1.4));
    const x = position
      ? Math.round(position.x - width / 2)
      : Math.round(canvasWidth / 2 - width / 2);
    const y = position
      ? Math.round(position.y - height / 2)
      : Math.round(canvasHeight / 2 - height / 2);
    const newLayer: TextLayer = {
      id: `${Date.now()}_txt_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Text Layer',
      type: 'text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      text: 'Double click to edit',
      fontFamily: textSettings.fontFamily,
      fontSize: textSettings.fontSize,
      fill: textSettings.fill,
      fontStyle: textSettings.fontStyle,
      textDecoration: 'none',
      align: textSettings.align,
      letterSpacing: textSettings.letterSpacing,
      lineHeight: textSettings.lineHeight,
      stroke: textSettings.stroke,
      strokeWidth: textSettings.strokeWidth,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 8,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowOpacity: 0.5,
      },
    };

    get().commitHistory('Add Text Layer');
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
      activeTool: 'select',
      isDocumentOpen: true,
    }));
  },

  addShapeLayer: (type = 'rectangle') => {
    const { canvasWidth, canvasHeight, shapeSettings } = get();
    const size = 180;
    const x = Math.round(canvasWidth / 2 - size / 2);
    const y = Math.round(canvasHeight / 2 - size / 2);

    const newLayer: ShapeLayer = {
      id: `${Date.now()}_shape_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(
        `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        get().layers
      ),
      type: 'shape',
      shapeType: type,
      visible: true,
      locked: false,
      opacity: shapeSettings.opacity,
      blendMode: 'source-over',
      x,
      y,
      width: size,
      height: size,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      fill: shapeSettings.fill,
      stroke: shapeSettings.stroke,
      strokeWidth: shapeSettings.strokeWidth,
      cornerRadius:
        type === 'rectangle' || type === 'callout' ? shapeSettings.cornerRadius : 0,
      sides: type === 'polygon' ? 6 : type === 'star' ? 5 : undefined,
      innerRadius:
        type === 'ring' || type === 'arc' ? 0.5 : type === 'star' ? 0.45 : undefined,
      angle: type === 'arc' ? 270 : type === 'wedge' ? 60 : undefined,
      points:
        type === 'arrow'
          ? [0, size / 2, size, size / 2]
          : type === 'line'
            ? [0, 0, size, size]
            : undefined,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 10,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowOpacity: 0.35,
      },
    };

    get().commitHistory(`Add ${type} Shape`);
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
      activeTool: 'select',
      isDocumentOpen: true,
    }));
  },

  addPathLayer: (anchors, closed = false) => {
    if (anchors.length < 2) return;
    const { penSettings } = get();
    const bounds = pathBounds(anchors, Math.max(8, penSettings.strokeWidth * 2));
    const localAnchors = normalizeAnchors(anchors, bounds.x, bounds.y);

    const newLayer: PathLayer = {
      id: `${Date.now()}_path_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(closed ? 'Closed Path' : 'Path', get().layers),
      type: 'path',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchors: localAnchors,
      closed,
      fill: penSettings.fill,
      stroke: penSettings.stroke,
      strokeWidth: penSettings.strokeWidth,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 6,
        shadowOffsetX: 1,
        shadowOffsetY: 2,
        shadowOpacity: 0.25,
      },
    };

    get().commitHistory(closed ? 'Add Closed Path' : 'Add Path');
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
    }));
  },

  addDrawingStroke: (layerId, stroke) => {
    set((state) => {
      const drawingLayer = state.layers.find((l) => l.id === layerId) as DrawingLayer | undefined;
      let newLayers = [...state.layers];

      if (!drawingLayer || drawingLayer.type !== 'drawing') {
        const newDrawLayer: DrawingLayer = {
          id: `${Date.now()}_draw`,
          name: 'Brush Drawing',
          type: 'drawing',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          width: state.canvasWidth,
          height: state.canvasHeight,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          strokes: [stroke],
        };
        newLayers.push(newDrawLayer);
        return {
          layers: newLayers,
          selectedLayerId: newDrawLayer.id,
        };
      }

      newLayers = newLayers.map((l) =>
        l.id === layerId && l.type === 'drawing'
          ? {
              ...l,
              strokes: [...l.strokes, stroke],
            }
          : l
      );

      return { layers: newLayers };
    });
  },

  setClippingMask: (id, clipToId) => {
    get().commitHistory('Set Clipping Mask');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, clippingMaskToId: clipToId } : l)),
    }));
  },

  removeClippingMask: (id) => {
    get().commitHistory('Remove Clipping Mask');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, clippingMaskToId: undefined } : l)),
    }));
  },

  toggleLayerMask: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const hasLayerMask = !!layer.hasLayerMask;
    get().commitHistory(hasLayerMask ? 'Remove Layer Mask' : 'Add Layer Mask');
    if (!hasLayerMask) {
      // Create a blank white (reveal all) mask as a base64 data URL
      const canvas = document.createElement('canvas');
      canvas.width = layer.width || 100;
      canvas.height = layer.height || 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const maskSrc = canvas.toDataURL('image/png');
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, hasLayerMask: true, layerMaskSrc: maskSrc } : l
        ),
      }));
    } else {
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, hasLayerMask: false, layerMaskSrc: undefined } : l
        ),
      }));
    }
  },

  paintLayerMask: (id, maskDataUrl) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, layerMaskSrc: maskDataUrl } : l
      ),
    }));
  },

  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setNewCanvasModalOpen: (open) => set({ isNewCanvasModalOpen: open }),
  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
  setOnboardingOpen: (open) => set({ isOnboardingOpen: open }),
  setImageSizeModalOpen: (open) => set({ isImageSizeModalOpen: open }),
  setStockModalOpen: (open) => set({ isStockModalOpen: open }),
  setExifModalOpen: (open) => set({ isExifModalOpen: open }),

  inspectSelectedExif: async () => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Select an image layer for EXIF',
        },
      });
      return;
    }
    try {
      const exif = await extractImageExif(layer.src, { fileName: layer.name });
      set({ lastExif: exif, isExifModalOpen: true });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'EXIF read failed'),
        },
      });
    }
  },

  compressSelectedImage: async (options = {}) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') return;

    get().recordActionStep('compress', 'Compress image', { ...options });
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 30,
        statusText: 'Compressing locally…',
        error: undefined,
      },
    });

    try {
      const result = await compressImageSource(layer.src, {
        maxEdge: options.maxEdge ?? 2048,
        quality: options.quality ?? 0.82,
        format: options.format ?? 'image/jpeg',
      });
      get().commitHistory('Compress image');
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === layer.id && l.type === 'image'
            ? {
                ...l,
                src: result.dataUrl,
                width: result.width,
                height: result.height,
              }
            : l
        ),
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Compressed · ~${Math.round(result.approxBytes / 1024)} KB · ${result.width}×${result.height}`,
        },
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Compress failed'),
        },
      });
    }
  },

  colorizeSelectedImage: async (preset = 'sepia', intensity = 0.85) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') return;

    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 25,
        statusText: `Colorize · ${preset}…`,
        error: undefined,
      },
    });

    try {
      const nextSrc = await colorizeImageSource(layer.src, preset, intensity);
      get().commitHistory(`Colorize · ${preset}`);
      const baked: ImageLayer = {
        ...deepClone(layer),
        id: `${Date.now()}_colorize`,
        name: derivativeName(layer.name, 'Colorize', get().layers),
        src: nextSrc,
        originalSrc: layer.originalSrc || layer.src,
        adjustments: { ...DEFAULT_ADJUSTMENTS },
      };
      set((state) => ({
        layers: [...state.layers, baked],
        selectedLayerId: baked.id,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Colorized · ${preset}`,
        },
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Colorize failed'),
        },
      });
    }
  },

  resizeImageLayer: async (id, options) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') {
      throw new Error('Select an image layer to resize');
    }

    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 35,
        statusText: 'Optimizing image size…',
      },
    });

    try {
      const result = await resizeImageSource(layer.src, {
        width: options.width,
        height: options.height,
        format: options.format,
        quality: options.quality,
      });

      get().commitHistory(`Resize ${layer.name}`);
      set((state) => ({
        canvasWidth: options.resizeCanvas
          ? result.width
          : state.canvasWidth,
        canvasHeight: options.resizeCanvas
          ? result.height
          : state.canvasHeight,
        layers: state.layers.map((l) =>
          l.id === id && l.type === 'image'
            ? {
                ...l,
                src: result.src,
                originalSrc: result.src,
                width: result.width,
                height: result.height,
                scaleX: 1,
                scaleY: 1,
                x: options.resizeCanvas ? 0 : l.x,
                y: options.resizeCanvas ? 0 : l.y,
              }
            : l
        ),
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Resized to ${result.width}×${result.height}`,
        },
      }));
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Resize failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
      throw e;
    }
  },
  setBeforeAfterOpen: (open) => set({ isBeforeAfterOpen: open }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  swapBrushColors: () =>
    set((state) => ({
      secondaryColor: state.brushSettings.color,
      brushSettings: { ...state.brushSettings, color: state.secondaryColor },
    })),
  resetBrushColors: () =>
    set({
      secondaryColor: '#ece8e1',
      brushSettings: { ...get().brushSettings, color: '#d4923a' },
    }),
  nudgeSelectedLayer: (dx, dy) => {
    const { selectedLayerId, layers } = get();
    if (!selectedLayerId) return;
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer || layer.locked) return;
    get().updateLayer(selectedLayerId, {
      x: Math.round(layer.x + dx),
      y: Math.round(layer.y + dy),
    });
  },
  setApiKeys: ({ removeBgApiKey, replicateApiKey }) => {
    if (removeBgApiKey !== undefined) {
      localStorage.setItem('px_remove_bg_key', removeBgApiKey);
      set({ removeBgApiKey });
    }
    if (replicateApiKey !== undefined) {
      localStorage.setItem('px_replicate_key', replicateApiKey);
      set({ replicateApiKey });
    }
  },

  setProjectTitle: (title) => set({ projectTitle: title }),

  saveProject: () => {
    const { projectTitle, canvasWidth, canvasHeight, backgroundColor, layers } = get();
    const project = buildProjectFile({
      title: projectTitle || 'Untitled',
      canvasWidth,
      canvasHeight,
      backgroundColor,
      layers,
    });
    downloadProjectFile(project);
  },

  loadProject: (project: ProjectFileData) => {
    set({
      projectTitle: project.title || 'Untitled',
      canvasWidth: project.canvasWidth,
      canvasHeight: project.canvasHeight,
      backgroundColor: project.backgroundColor,
      layers: structuredClone(project.layers),
      selectedLayerId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      isDocumentOpen: true,
      cropSettings: {
        active: false,
        aspect: 'free',
        x: 0,
        y: 0,
        width: project.canvasWidth,
        height: project.canvasHeight,
        rotation: 0,
      },
      activeTool: 'select',
    });
  },

  saveProjectToCloud: async () => {
    const { projectTitle, canvasWidth, canvasHeight, backgroundColor, layers, cloudProjectId } =
      get();
    const dto = {
      title: projectTitle || 'Untitled',
      canvasWidth,
      canvasHeight,
      backgroundColor,
      layers,
      id: cloudProjectId || undefined,
    };

    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 40,
        statusText: 'Saving project to API…',
      },
    });

    try {
      const saved = cloudProjectId
        ? await aiApiClient.updateProject(cloudProjectId, dto)
        : await aiApiClient.createProject(dto);

      set({
        cloudProjectId: saved.id,
        projectTitle: saved.title,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Saved · ${saved.title}`,
        },
      });
      return saved;
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Cloud save failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
      throw e;
    }
  },

  listCloudProjects: () => aiApiClient.listProjects(),

  loadProjectFromCloud: async (id) => {
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 30,
        statusText: 'Loading cloud project…',
      },
    });
    try {
      const detail = await aiApiClient.getProject(id);
      get().loadProject({
        version: '1.0',
        title: detail.title,
        canvasWidth: detail.canvasWidth,
        canvasHeight: detail.canvasHeight,
        backgroundColor: detail.backgroundColor,
        layers: detail.layers as ProjectFileData['layers'],
        savedAt: detail.savedAt,
      });
      set({
        cloudProjectId: detail.id,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Opened · ${detail.title}`,
        },
      });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Cloud open failed'),
        },
      });
      throw e;
    }
  },

  // ───────────────────────── Gradient & tone brush settings ─────────────────────────

  updateGradientSettings: (settings) =>
    set((state) => ({ gradientSettings: { ...state.gradientSettings, ...settings } })),

  updateToneBrushSettings: (settings) =>
    set((state) => ({ toneBrushSettings: { ...state.toneBrushSettings, ...settings } })),

  // ───────────────────────── Guides ─────────────────────────

  addGuide: (orientation, position) => {
    const guide: Guide = { id: makeId('guide'), orientation, position: Math.round(position) };
    set((state) => ({ guides: [...state.guides, guide] }));
    return guide.id;
  },

  removeGuide: (id) => set((state) => ({ guides: state.guides.filter((g) => g.id !== id) })),

  clearGuides: () => set({ guides: [] }),

  setSnapToGuides: (snap) => set({ snapToGuides: snap }),

  // ───────────────────────── Artboards ─────────────────────────

  addArtboard: (artboard = {}) => {
    const { artboards, canvasWidth, canvasHeight } = get();
    const last = artboards[artboards.length - 1];
    const names = new Set(artboards.map((a) => a.name));
    let n = artboards.length + 1;
    while (names.has(`Artboard ${n}`)) n += 1;

    const created: Artboard = {
      id: makeId('artboard'),
      name: `Artboard ${n}`,
      x: last ? last.x + last.width + 80 : 0,
      y: last ? last.y : 0,
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      ...artboard,
    };
    set((state) => ({
      artboards: [...state.artboards, created],
      activeArtboardId: created.id,
    }));
    return created.id;
  },

  setActiveArtboard: (id) => set({ activeArtboardId: id }),

  updateArtboard: (id, updates) =>
    set((state) => ({
      artboards: state.artboards.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeArtboard: (id) =>
    set((state) => {
      const artboards = state.artboards.filter((a) => a.id !== id);
      return {
        artboards,
        activeArtboardId:
          state.activeArtboardId === id
            ? (artboards[artboards.length - 1]?.id ?? null)
            : state.activeArtboardId,
      };
    }),

  // ───────────────────────── Actions (macro recording) ─────────────────────────

  startRecordingAction: () => set({ isRecordingAction: true, recordingSteps: [] }),

  recordActionStep: (type, label, payload) => {
    if (!get().isRecordingAction || isPlayingAction) return;
    const step: EditorActionStep = { id: makeId('step'), label, type, payload };
    set((state) => ({ recordingSteps: [...state.recordingSteps, step] }));
  },

  stopRecordingAction: (name) => {
    const { isRecordingAction, recordingSteps, actions } = get();
    if (!isRecordingAction) return null;
    const action: EditorAction = {
      id: makeId('action'),
      name: name.trim() || `Action ${actions.length + 1}`,
      steps: recordingSteps,
    };
    set({ isRecordingAction: false, recordingSteps: [], actions: [...actions, action] });
    return action;
  },

  playAction: async (id) => {
    const action = get().actions.find((a) => a.id === id);
    if (!action || isPlayingAction) return;

    const selectedImageId = (): string | null => {
      const { layers, selectedLayerId } = get();
      const layer = layers.find((l) => l.id === selectedLayerId);
      return layer && layer.type === 'image' ? layer.id : null;
    };

    isPlayingAction = true;
    try {
      for (const step of action.steps) {
        const payload = (step.payload ?? {}) as Record<string, unknown>;
        const layerId = selectedImageId();
        if (!layerId) continue; // every supported step targets the selected image layer

        switch (step.type) {
          case 'revive':
            await get().revivePhotoLayer(
              layerId,
              (payload.mode as ReviveMode | undefined) ?? 'natural',
              (payload.intensity as number | undefined) ?? 0.75,
              (payload.bakeNewLayer as boolean | undefined) ?? false
            );
            break;
          case 'cleanup':
            await get().cleanPhotoLayer(
              layerId,
              (payload.mode as CleanupMode | undefined) ?? 'standard',
              (payload.intensity as number | undefined) ?? 0.7,
              (payload.bakeNewLayer as boolean | undefined) ?? true
            );
            break;
          case 'desaturate':
            get().commitHistory('Desaturate');
            get().updateAdjustments(layerId, { grayscale: true });
            break;
          case 'invert': {
            const layer = get().layers.find((l) => l.id === layerId);
            if (layer?.type !== 'image') break;
            get().commitHistory('Invert');
            get().updateAdjustments(layerId, { invert: !layer.adjustments.invert });
            break;
          }
          case 'classic-filter':
            await get().bakeClassicFilterOnSelected(
              (payload.kind as ClassicFilterKind | undefined) ?? 'gaussian',
              payload.params as Record<string, number> | undefined
            );
            break;
          case 'compress':
            await get().compressSelectedImage(
              payload as Parameters<EditorState['compressSelectedImage']>[0]
            );
            break;
          default:
            break; // unknown step types are skipped
        }
      }
    } finally {
      isPlayingAction = false;
    }
  },

  deleteAction: (id) => set((state) => ({ actions: state.actions.filter((a) => a.id !== id) })),

  // ───────────────────────── Transform ─────────────────────────

  setTransformMode: (mode) => set({ transformMode: mode }),

  // ───────────────────────── Photoshop-lite feature operations ─────────────────────────

  addAdjustmentLayer: (kind) => {
    const { layers, selectedLayerId, canvasWidth, canvasHeight } = get();
    const label = ADJUSTMENT_LABELS[kind];
    const count = layers.filter((l) => l.type === 'adjustment' && l.kind === kind).length;

    const adjustments: AdjustmentLayer['adjustments'] = { ...DEFAULT_ADJUSTMENTS };
    if (kind === 'curves') adjustments.curves = deepClone(DEFAULT_CURVES);
    if (kind === 'levels') adjustments.levels = { ...DEFAULT_LEVELS };
    if (kind === 'invert') adjustments.invert = true;
    if (kind === 'grayscale') adjustments.grayscale = true;

    const layer: AdjustmentLayer = {
      id: makeId('adj'),
      name: uniqueLayerName(`${label} ${count + 1}`, layers),
      type: 'adjustment',
      kind,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      adjustments,
      affectedChannel: 'rgb',
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => {
      const selectedIdx = state.layers.findIndex((l) => l.id === selectedLayerId);
      const insertAt = selectedIdx >= 0 ? selectedIdx + 1 : state.layers.length;
      const next = [...state.layers];
      next.splice(insertAt, 0, layer);
      return { layers: next, selectedLayerId: layer.id };
    });
  },

  addGradientLayerFromDrag: (x1, y1, x2, y2) => {
    const { layers, canvasWidth, canvasHeight, gradientSettings } = get();
    if (Math.hypot(x2 - x1, y2 - y1) < 2) return;

    const layer: GradientLayer = {
      id: makeId('grad'),
      name: uniqueLayerName('Gradient', layers),
      type: 'gradient',
      visible: true,
      locked: false,
      opacity: gradientSettings.opacity,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      gradientType: gradientSettings.gradientType,
      colorStops: deepClone(gradientSettings.colorStops),
      angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      // Layer sits at the document origin, so layer-local === document coordinates
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
      isDocumentOpen: true,
    }));
  },

  bakeClassicFilterOnSelected: async (kind, params) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') return;

    get().recordActionStep('classic-filter', `Filter · ${kind}`, { kind, params });
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 30,
        statusText: `Applying ${kind} filter…`,
        error: undefined,
      },
    });

    try {
      const baked = await bakeClassicFilter(layer.src, kind, params);
      get().commitHistory(`Filter · ${kind}`);
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === layer.id && l.type === 'image' ? { ...l, src: baked } : l
        ),
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Filter applied · ${kind}`,
        },
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Filter failed'),
        },
      });
    }
  },

  modifyMarqueeSelection: async (op, amount) => {
    const { marqueeSelection: sel, canvasWidth, canvasHeight } = get();
    if (!sel) return;

    if (op === 'invert') {
      set({ marqueeSelection: invertSelection(sel, canvasWidth, canvasHeight) });
      return;
    }
    if (op === 'expand') {
      set({ marqueeSelection: expandSelection(sel, amount ?? 4) });
      return;
    }
    if (op === 'contract') {
      set({ marqueeSelection: contractSelection(sel, amount ?? 4) });
      return;
    }

    // feather: a soft mask can't be stored as a SelectionShape, so it becomes the layer mask
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Select an image layer to feather the selection into a mask',
        },
      });
      return;
    }

    try {
      const docMask = await featherSelectionMask(sel, amount ?? 8, canvasWidth, canvasHeight);
      const layerMask = await selectionMaskToLayerMask(docMask, layer, canvasWidth, canvasHeight);
      get().commitHistory('Feather Selection');
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === layer.id ? { ...l, hasLayerMask: true, layerMaskSrc: layerMask } : l
        ),
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Feather failed'),
        },
      });
    }
  },

  applyCurvesToSelected: async (curves, options) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || (layer.type !== 'image' && layer.type !== 'adjustment')) return;

    if (options?.bake && layer.type === 'image') {
      try {
        const baked = await bakeCurvesLevels(layer.src, { curves });
        get().commitHistory('Bake Curves');
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layer.id && l.type === 'image' ? { ...l, src: baked } : l
          ),
        }));
      } catch (e: unknown) {
        set({
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 0,
            statusText: '',
            error: getErrorMessage(e, 'Curves failed'),
          },
        });
      }
      return;
    }

    get().commitHistory('Curves');
    get().updateAdjustments(layer.id, { curves: deepClone(curves) });
  },

  applyLevelsToSelected: async (levels, options) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || (layer.type !== 'image' && layer.type !== 'adjustment')) return;

    if (options?.bake && layer.type === 'image') {
      try {
        const baked = await bakeCurvesLevels(layer.src, { levels });
        get().commitHistory('Bake Levels');
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layer.id && l.type === 'image' ? { ...l, src: baked } : l
          ),
        }));
      } catch (e: unknown) {
        set({
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 0,
            statusText: '',
            error: getErrorMessage(e, 'Levels failed'),
          },
        });
      }
      return;
    }

    get().commitHistory('Levels');
    get().updateAdjustments(layer.id, { levels: { ...levels } });
  },

  convertSelectedToSmartObject: () => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image' || layer.smartObject) return;

    get().commitHistory('Convert to Smart Object');
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layer.id && l.type === 'image'
          ? { ...l, smartObject: true, smartObjectSrc: l.originalSrc || l.src }
          : l
      ),
    }));
  },

  replaceSmartObjectSource: (src, width, height) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image' || !layer.smartObject) return;

    const updates: Partial<ImageLayer> = { src, originalSrc: src, smartObjectSrc: src };
    if (width && height && width > 0 && height > 0) {
      // Contain-fit the new content inside the layer's current on-canvas box
      const boxW = layer.width * Math.abs(layer.scaleX);
      const boxH = layer.height * Math.abs(layer.scaleY);
      const k = Math.min(boxW / width, boxH / height);
      updates.width = Math.max(1, Math.round(width * k));
      updates.height = Math.max(1, Math.round(height * k));
      updates.scaleX = layer.scaleX < 0 ? -1 : 1;
      updates.scaleY = layer.scaleY < 0 ? -1 : 1;
    }

    get().commitHistory('Replace Smart Object Contents');
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layer.id && l.type === 'image' ? { ...l, ...updates } : l
      ),
    }));
  },

  pathToSelection: () => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'path') return;

    const path = flattenPathLayer(layer);
    if (path.length < 6) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < path.length; i += 2) {
      minX = Math.min(minX, path[i]);
      maxX = Math.max(maxX, path[i]);
      minY = Math.min(minY, path[i + 1]);
      maxY = Math.max(maxY, path[i + 1]);
    }

    set({
      marqueeSelection: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        mode: 'rect',
        path,
      },
    });
  },

  strokePathAsDrawing: () => {
    const { layers, selectedLayerId, canvasWidth, canvasHeight, brushSettings } = get();
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer || layer.type !== 'path') return;

    const points = flattenPathLayer(layer);
    if (points.length < 4) return;
    if (layer.closed) points.push(points[0], points[1]);

    const hasOwnStroke =
      layer.strokeWidth > 0 && !!layer.stroke && layer.stroke !== 'transparent';
    const drawing: DrawingLayer = {
      id: makeId('draw'),
      name: uniqueLayerName('Path Stroke', layers),
      type: 'drawing',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      strokes: [
        {
          points,
          color: hasOwnStroke ? layer.stroke : brushSettings.color,
          size: hasOwnStroke ? Math.max(1, layer.strokeWidth) : brushSettings.size,
          opacity: hasOwnStroke ? 1 : brushSettings.opacity,
          isEraser: false,
          hardness: brushSettings.hardness,
        },
      ],
    };

    get().commitHistory('Stroke Path');
    set((state) => {
      const idx = state.layers.findIndex((l) => l.id === layer.id);
      const next = [...state.layers];
      next.splice(idx >= 0 ? idx + 1 : next.length, 0, drawing);
      return { layers: next, selectedLayerId: drawing.id };
    });
  },

  placeGradientFill: (x1, y1, x2, y2) => {
    const { layers, canvasWidth, canvasHeight, gradientSettings } = get();
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 2) return;

    const w = Math.max(1, Math.round(canvasWidth));
    const h = Math.max(1, Math.round(canvasHeight));
    const src =
      gradientSettings.gradientType === 'radial'
        ? createRadialGradientDataUrl(w, h, {
            cx: x1,
            cy: y1,
            r: dist,
            colorStops: gradientSettings.colorStops,
          })
        : createLinearGradientDataUrl(w, h, {
            x1,
            y1,
            x2,
            y2,
            colorStops: gradientSettings.colorStops,
          });

    const layer: ImageLayer = {
      id: makeId('gradfill'),
      name: uniqueLayerName('Gradient Fill', layers),
      type: 'image',
      visible: true,
      locked: false,
      opacity: gradientSettings.opacity,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      src,
      originalSrc: src,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
      isDocumentOpen: true,
    }));
  },
}));
