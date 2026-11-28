import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { SelectionShape } from '../../types/editor';
import {
  getErrorMessage,
  invertSelection,
  expandSelection,
  contractSelection,
  featherSelectionMask,
} from '@photoshop-lite/editor-core';
import { flattenPathLayer, selectionMaskToLayerMask } from '../helpers';

export interface SelectionSlice {
  marqueeSelection: SelectionShape | null;
  /** Named alpha channels saved from selections (document-space masks). */
  savedSelections: { id: string; name: string; maskSrc: string }[];
  setMarqueeSelection: (sel: SelectionShape | null) => void;
  modifyMarqueeSelection: (
    op: 'invert' | 'expand' | 'contract' | 'feather',
    amount?: number,
    options?: { bakeToLayerMask?: boolean }
  ) => Promise<void>;
  pathToSelection: () => void;
  /** Commit soft selection (or current marquee) onto the active image layer mask. */
  applySelectionToLayerMask: () => Promise<void>;
  saveSelectionAsChannel: (name?: string) => Promise<void>;
  loadSelectionFromChannel: (id: string) => void;
  deleteSavedSelection: (id: string) => void;
}

export const createSelectionSlice: StateCreator<EditorStore, [], [], SelectionSlice> = (
  set,
  get
) => ({
  marqueeSelection: null,

  savedSelections: [],

  setMarqueeSelection: (sel) => set({ marqueeSelection: sel }),

  modifyMarqueeSelection: async (op, amount, options) => {
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

    // Live soft selection by default; optional bake to layer mask
    try {
      const docMask = await featherSelectionMask(sel, amount ?? 8, canvasWidth, canvasHeight);
      if (options?.bakeToLayerMask) {
        const layer = get().layers.find((l) => l.id === get().selectedLayerId);
        if (!layer || layer.type !== 'image') {
          set({
            aiStatus: {
              isProcessing: false,
              action: null,
              progress: 0,
              statusText: '',
              error: 'Select an image layer to bake feather into a mask',
            },
          });
          return;
        }
        const layerMask = await selectionMaskToLayerMask(docMask, layer, canvasWidth, canvasHeight);
        get().commitHistory('Feather → Layer Mask');
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layer.id ? { ...l, hasLayerMask: true, layerMaskSrc: layerMask } : l
          ),
          marqueeSelection: { ...sel, softMaskSrc: docMask },
        }));
        return;
      }

      set({
        marqueeSelection: {
          ...sel,
          softMaskSrc: docMask,
        },
      });
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

  applySelectionToLayerMask: async () => {
    const { marqueeSelection: sel, canvasWidth, canvasHeight, selectedLayerId, layers } = get();
    if (!sel) return;
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Select an image layer to apply the selection as a mask',
        },
      });
      return;
    }
    try {
      const docMask =
        sel.softMaskSrc ||
        (await featherSelectionMask(sel, 0, canvasWidth, canvasHeight));
      const layerMask = await selectionMaskToLayerMask(docMask, layer, canvasWidth, canvasHeight);
      get().commitHistory('Selection → Layer Mask');
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
          error: getErrorMessage(e, 'Apply mask failed'),
        },
      });
    }
  },

  saveSelectionAsChannel: async (name) => {
    const { marqueeSelection: sel, canvasWidth, canvasHeight, savedSelections } = get();
    if (!sel) return;
    try {
      const maskSrc =
        sel.softMaskSrc ||
        (await featherSelectionMask(sel, 0, canvasWidth, canvasHeight));
      const entry = {
        id: `${Date.now()}_ch`,
        name: name?.trim() || `Alpha ${savedSelections.length + 1}`,
        maskSrc,
      };
      set({ savedSelections: [...savedSelections, entry] });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Save selection failed'),
        },
      });
    }
  },

  loadSelectionFromChannel: (id) => {
    const entry = get().savedSelections.find((c) => c.id === id);
    if (!entry) return;
    const { canvasWidth, canvasHeight } = get();
    set({
      marqueeSelection: {
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        mode: 'rect',
        softMaskSrc: entry.maskSrc,
      },
    });
  },

  deleteSavedSelection: (id) => {
    set((state) => ({
      savedSelections: state.savedSelections.filter((c) => c.id !== id),
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
});
