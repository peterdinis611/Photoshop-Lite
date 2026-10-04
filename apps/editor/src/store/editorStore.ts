import { create } from 'zustand';
import {
  EditorLayer,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  DrawingLayer,
  ToolType,
  ShapeType,
  BlendMode,
  BrushSettings,
  CropSettings,
  HistorySnapshot,
  AIStatus,
  ImageAdjustments,
  ProjectFileData,
  MarqueeMode,
  SelectionShape,
} from '../types/editor';
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS, clientSideSuperResolution, deepClone, getErrorMessage, bakeRevivePixels, computeReviveAdjustments, bakeCleanupPixels, buildProjectFile, downloadProjectFile, selectionToMaskDataUrl, type ReviveMode, type CleanupMode } from '@photoshop-lite/editor-core';
import { executeBackgroundRemoval, aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { AiJobKind, AiStylePreset, ProjectSummaryDto } from '@photoshop-lite/shared-types';
import { resizeImageSource } from '../utils/resizeImage';

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
  cropSettings: CropSettings;
  marqueeMode: MarqueeMode;
  wandTolerance: number;

  // Layers
  layers: EditorLayer[];
  selectedLayerId: string | null;
  marqueeSelection: SelectionShape | null;
  setMarqueeSelection: (sel: SelectionShape | null) => void;


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

  // Actions - Canvas & View
  setCanvasDimensions: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
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
  setCropSettings: (settings: Partial<CropSettings>) => void;
  applyCrop: () => void;
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

  // Actions - AI Operations
  removeBackground: (id: string, provider?: 'client' | 'remove.bg') => Promise<void>;
  upscaleLayer: (id: string, scaleFactor?: number) => Promise<void>;
  runCloudAiJob: (
    id: string,
    kind: AiJobKind,
    options?: { intensity?: number; prompt?: string; style?: AiStylePreset }
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
  addTextLayer: () => void;
  addShapeLayer: (type?: ShapeType) => void;
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
  resizeImageLayer: (
    id: string,
    options: {
      width: number;
      height: number;
      format?: 'image/jpeg' | 'image/webp' | 'image/png';
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
    refineMode: 'erase',
  },
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
  isShortcutsModalOpen: false,
  isOnboardingOpen: false,
  isBeforeAfterOpen: false,
  secondaryColor: '#ece8e1',
  isSettingsModalOpen: false,
  isNewCanvasModalOpen: false,
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
      const { canvasWidth, canvasHeight } = get();
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

  setCropSettings: (settings) =>
    set((state) => ({ cropSettings: { ...state.cropSettings, ...settings } })),

  applyCrop: () => {
    const { cropSettings, layers } = get();
    if (!cropSettings.active) return;

    get().commitHistory('Crop Canvas');
    const { x, y, width, height } = cropSettings;

    // Shift all layers relative to new origin
    const updatedLayers = layers.map((layer) => ({
      ...layer,
      x: layer.x - x,
      y: layer.y - y,
    }));

    set({
      canvasWidth: Math.max(50, Math.round(width)),
      canvasHeight: Math.max(50, Math.round(height)),
      layers: updatedLayers,
      activeTool: 'select',
      cropSettings: { ...cropSettings, active: false },
    });
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
        if (layer.id === id && layer.type === 'image') {
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
      'face-restore': 'Face Restore',
      style: 'Style Transfer',
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

      if (kind === 'inpaint') {
        const sel = get().marqueeSelection;
        if (!sel) {
          throw new Error('Draw a marquee/lasso selection for inpaint first');
        }
        maskBase64 = await selectionToMaskDataUrl({
          canvasWidth: get().canvasWidth,
          canvasHeight: get().canvasHeight,
          selection: sel,
        });
      }

      const jobBody = {
        imageBase64: layer.src,
        apiKey,
        intensity: options.intensity ?? 0.7,
        prompt: options.prompt,
        style: options.style,
        maskBase64,
      };

      const starters: Record<AiJobKind, () => ReturnType<typeof aiApiClient.cleanup>> = {
        cleanup: () => aiApiClient.cleanup(jobBody),
        revive: () => aiApiClient.revive(jobBody),
        inpaint: () => aiApiClient.inpaint(jobBody),
        'face-restore': () => aiApiClient.faceRestore(jobBody),
        style: () => aiApiClient.style(jobBody),
        segment: () => aiApiClient.segment(jobBody),
        caption: () => aiApiClient.caption(jobBody),
      };

      const started = await starters[kind]();
      if (started.fallbackToClient) {
        throw new Error(started.message || 'Server AI unavailable — set REPLICATE_API_TOKEN');
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
        marqueeSelection: kind === 'inpaint' ? null : state.marqueeSelection,
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
    }));
  },

  addTextLayer: () => {
    const { canvasWidth, canvasHeight } = get();
    const newLayer: TextLayer = {
      id: `${Date.now()}_txt_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Text Layer',
      type: 'text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: Math.round(canvasWidth / 2 - 120),
      y: Math.round(canvasHeight / 2 - 30),
      width: 240,
      height: 60,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      text: 'Double click to edit',
      fontFamily: 'Source Sans 3',
      fontSize: 36,
      fill: '#ece8e1',
      fontStyle: 'bold',
      textDecoration: 'none',
      align: 'center',
      letterSpacing: 0,
      lineHeight: 1.2,
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
    }));
  },

  addShapeLayer: (type = 'rectangle') => {
    const { canvasWidth, canvasHeight } = get();
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
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width: size,
      height: size,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      fill: '#d4923a',
      stroke: '#ece8e1',
      strokeWidth: 2,
      cornerRadius: type === 'rectangle' || type === 'callout' ? 12 : 0,
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
}));
