import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { ImageLayer, ImageAdjustments, LevelsAdjustment, CurvesAdjustment } from '../../types/editor';
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS, deepClone, getErrorMessage, compressImageSource, colorizeImageSource, bakeCurvesLevels, bakeClassicFilter, perspectiveCropToRect, type ClassicFilterKind, type ColorizePreset, type CompressFormat, type Quad } from '@photoshop-lite/editor-core';
import { resizeImageSource } from '../../utils/resizeImage';
import { applyCropToImageLayer } from '../../utils/cropImage';
import { derivativeName } from '../helpers';

export interface AdjustmentsSlice {
  bakeClassicFilterOnSelected: (
    kind: ClassicFilterKind,
    params?: Record<string, number>
  ) => Promise<void>;
  /** Add a Smart Filter on a smart object (re-bakes from linked source). */
  addSmartFilterOnSelected: (
    kind: ClassicFilterKind,
    params?: Record<string, number>
  ) => Promise<void>;
  rebakeSmartFilters: (layerId: string) => Promise<void>;
  /** Stores curves live in adjustments.curves; pass { bake: true } to bake into pixels instead. */
  applyCurvesToSelected: (curves: CurvesAdjustment, options?: { bake?: boolean }) => Promise<void>;
  /** Stores levels live in adjustments.levels; pass { bake: true } to bake into pixels instead. */
  applyLevelsToSelected: (levels: LevelsAdjustment, options?: { bake?: boolean }) => Promise<void>;
  applyCrop: () => Promise<void>;
  updateAdjustments: (id: string, adjustments: Partial<ImageAdjustments>) => void;
  applyPresetToLayer: (id: string, presetId: string) => void;
  autoEnhanceLayer: (id: string) => Promise<void>;
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
}

export const createAdjustmentsSlice: StateCreator<EditorStore, [], [], AdjustmentsSlice> = (set, get) => ({
  applyCrop: async () => {
    const { cropSettings, layers, selectedLayerId } = get();
    if (!cropSettings.active) return;

    const crop = {
      x: cropSettings.x,
      y: cropSettings.y,
      width: Math.max(1, cropSettings.width),
      height: Math.max(1, cropSettings.height),
    };

    // Perspective: flatten the keystone quad on the selected image into a rectangle
    if (cropSettings.mode === 'perspective' && cropSettings.perspectiveCorners) {
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (!layer || layer.type !== 'image') {
        set({
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 0,
            statusText: '',
            error: 'Select an image layer for perspective crop',
          },
        });
        return;
      }
      set({
        aiStatus: {
          isProcessing: true,
          action: null,
          progress: 40,
          statusText: 'Perspective crop…',
        },
      });
      try {
        const sx = Math.abs(layer.scaleX) || 1;
        const sy = Math.abs(layer.scaleY) || 1;
        const localQuad = cropSettings.perspectiveCorners.map((p) => ({
          x: (p.x - layer.x) / sx,
          y: (p.y - layer.y) / sy,
        })) as Quad;
        const outW = Math.max(
          32,
          Math.round(
            Math.hypot(
              cropSettings.perspectiveCorners[1].x - cropSettings.perspectiveCorners[0].x,
              cropSettings.perspectiveCorners[1].y - cropSettings.perspectiveCorners[0].y
            )
          )
        );
        const outH = Math.max(
          32,
          Math.round(
            Math.hypot(
              cropSettings.perspectiveCorners[3].x - cropSettings.perspectiveCorners[0].x,
              cropSettings.perspectiveCorners[3].y - cropSettings.perspectiveCorners[0].y
            )
          )
        );
        const result = await perspectiveCropToRect(layer.src, localQuad, outW, outH);
        if (!result) throw new Error('Perspective crop failed');
        get().commitHistory('Perspective Crop');
        const next: ImageLayer = {
          ...layer,
          src: result.src,
          width: result.width,
          height: result.height,
          scaleX: layer.scaleX < 0 ? -1 : 1,
          scaleY: layer.scaleY < 0 ? -1 : 1,
          x: Math.round(
            Math.min(...cropSettings.perspectiveCorners.map((c) => c.x))
          ),
          y: Math.round(
            Math.min(...cropSettings.perspectiveCorners.map((c) => c.y))
          ),
        };
        set((state) => ({
          layers: state.layers.map((l) => (l.id === layer.id ? next : l)),
          cropSettings: { ...state.cropSettings, active: false, mode: 'rect' },
          activeTool: 'select',
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: 'Perspective crop applied',
          },
        }));
      } catch (e: unknown) {
        set({
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 0,
            statusText: '',
            error: getErrorMessage(e, 'Perspective crop failed'),
          },
        });
      }
      return;
    }

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

  bakeClassicFilterOnSelected: async (kind, params) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') return;

    // Smart objects keep a filter stack instead of destructive bake
    if (layer.smartObject) {
      await get().addSmartFilterOnSelected(kind, params);
      return;
    }

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

  addSmartFilterOnSelected: async (kind, params) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') return;
    if (!layer.smartObject) {
      get().convertSelectedToSmartObject();
    }
    const id = `sf_${Date.now().toString(36)}`;
    get().commitHistory(`Smart Filter · ${kind}`);
    set((state) => ({
      layers: state.layers.map((l) => {
        if (l.id !== layer.id || l.type !== 'image') return l;
        const stack = [...(l.smartFilters || []), { id, kind, enabled: true, params }];
        return { ...l, smartFilters: stack, smartObject: true };
      }),
    }));
    await get().rebakeSmartFilters(layer.id);
  },

  rebakeSmartFilters: async (layerId) => {
    const layer = get().layers.find((l) => l.id === layerId);
    if (!layer || layer.type !== 'image') return;
    const base = layer.smartObjectSrc || layer.originalSrc || layer.src;
    const stack = (layer.smartFilters || []).filter((f) => f.enabled);
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 40,
        statusText: 'Rebaking smart filters…',
        error: undefined,
      },
    });
    try {
      let src = base;
      for (const f of stack) {
        src = await bakeClassicFilter(src, f.kind, f.params);
      }
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === layerId && l.type === 'image' ? { ...l, src } : l
        ),
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: stack.length ? `Smart filters · ${stack.length}` : 'Smart filters cleared',
        },
      }));
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Smart filter bake failed'),
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
});
