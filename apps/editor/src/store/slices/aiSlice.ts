import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { ImageLayer, AIStatus } from '../../types/editor';
import { DEFAULT_ADJUSTMENTS, clientSideSuperResolution, deepClone, getErrorMessage, bakeRevivePixels, computeReviveAdjustments, bakeCleanupPixels, bakeRelightPixels, bakePortraitPixels, bakeClarityPixels, bakeColorMatchPixels, computeOutpaintLayout, expandImageWithEdgeFill, buildOutpaintBorderMask, rasterizeImageToSize, selectionToMaskDataUrl, type ReviveMode, type CleanupMode, type RelightMode, type PortraitMode, type ClarityMode, type OutpaintPreset } from '@photoshop-lite/editor-core';
import { executeBackgroundRemoval, aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { AiJobKind, AiStylePreset, AiRelightPreset } from '@photoshop-lite/shared-types';
import { derivativeName, rasterMaskToLayerMask } from '../helpers';

export interface AISlice {
  aiStatus: AIStatus;
  removeBgApiKey: string;
  replicateApiKey: string;
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
      /** Segment: apply result as non-destructive layer mask instead of a new layer */
      applyAsMask?: boolean;
    }
  ) => Promise<void>;
  setAIStatus: (status: Partial<AIStatus>) => void;
  setApiKeys: (keys: { removeBgApiKey?: string; replicateApiKey?: string }) => void;
}

export const createAISlice: StateCreator<EditorStore, [], [], AISlice> = (set, get) => ({
  aiStatus: {
    isProcessing: false,
    action: null,
    progress: 0,
    statusText: '',
  },

  removeBgApiKey: localStorage.getItem('px_remove_bg_key') || '',

  replicateApiKey: localStorage.getItem('px_replicate_key') || '',

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
          `${actionLabel[kind]} needs Replicate or Hugging Face. Set REPLICATE_API_TOKEN or HF_TOKEN in .env (or paste an r8_ key in Lab → Keys). Local Revive / Clean / Relight / Cutout / Upscale still work offline.`
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

      if (kind === 'segment' && !resultSrc && resultText) {
        set({
          lastCaption: resultText,
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: resultText,
          },
        });
        return;
      }

      if (!resultSrc) {
        throw new Error('Cloud job returned no image');
      }

      if (kind === 'segment' && options.applyAsMask !== false) {
        const layerMaskSrc = await rasterMaskToLayerMask(resultSrc, layer);
        get().commitHistory('Segment Mask');
        get().updateLayer(id, { hasLayerMask: true, layerMaskSrc });
        set({
          activeTool: 'refineBrush',
          aiStatus: {
            isProcessing: false,
            action: null,
            progress: 100,
            statusText: 'Segment applied as layer mask — refine edges',
          },
        });
        return;
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
});
