import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { SelectionShape } from '../../types/editor';
import { getErrorMessage, invertSelection, expandSelection, contractSelection, featherSelectionMask } from '@photoshop-lite/editor-core';
import { flattenPathLayer, selectionMaskToLayerMask } from '../helpers';

export interface SelectionSlice {
  marqueeSelection: SelectionShape | null;
  setMarqueeSelection: (sel: SelectionShape | null) => void;
  modifyMarqueeSelection: (
    op: 'invert' | 'expand' | 'contract' | 'feather',
    amount?: number
  ) => Promise<void>;
  pathToSelection: () => void;
}

export const createSelectionSlice: StateCreator<EditorStore, [], [], SelectionSlice> = (set, get) => ({
  marqueeSelection: null,

  setMarqueeSelection: (sel) => set({ marqueeSelection: sel }),

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
