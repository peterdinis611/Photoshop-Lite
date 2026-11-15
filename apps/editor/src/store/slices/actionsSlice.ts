import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { EditorAction, EditorActionStep } from '../../types/editor';
import type { ClassicFilterKind, ReviveMode, CleanupMode } from '@photoshop-lite/editor-core';
import { makeId, isActionPlaying, setActionPlaying } from '../helpers';

export interface ActionsSlice {
  actions: EditorAction[];
  isRecordingAction: boolean;
  recordingSteps: EditorActionStep[];
  startRecordingAction: () => void;
  /** Appends a step while recording (no-op otherwise / during playback). */
  recordActionStep: (type: string, label: string, payload?: Record<string, unknown>) => void;
  stopRecordingAction: (name: string) => EditorAction | null;
  playAction: (id: string) => Promise<void>;
  deleteAction: (id: string) => void;
}

export const createActionsSlice: StateCreator<EditorStore, [], [], ActionsSlice> = (set, get) => ({
  actions: [],

  isRecordingAction: false,

  recordingSteps: [],

  startRecordingAction: () => set({ isRecordingAction: true, recordingSteps: [] }),

  recordActionStep: (type, label, payload) => {
    if (!get().isRecordingAction || isActionPlaying()) return;
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
    if (!action || isActionPlaying()) return;

    const selectedImageId = (): string | null => {
      const { layers, selectedLayerId } = get();
      const layer = layers.find((l) => l.id === selectedLayerId);
      return layer && layer.type === 'image' ? layer.id : null;
    };

    setActionPlaying(true);
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
              payload as Parameters<EditorStore['compressSelectedImage']>[0]
            );
            break;
          default:
            break; // unknown step types are skipped
        }
      }
    } finally {
      setActionPlaying(false);
    }
  },

  deleteAction: (id) => set((state) => ({ actions: state.actions.filter((a) => a.id !== id) })),
});
