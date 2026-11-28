import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { EditorAction, EditorActionStep, BlendMode, EditorLayer } from '../../types/editor';
import type { ClassicFilterKind, ReviveMode, CleanupMode } from '@photoshop-lite/editor-core';
import type { AiJobKind, AiRelightPreset, AiStylePreset } from '@photoshop-lite/shared-types';
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

    const resolveLayerId = (payload: Record<string, unknown>): string | null => {
      const fromPayload = payload.id;
      if (typeof fromPayload === 'string') return fromPayload;
      const { layers, selectedLayerId } = get();
      const layer = layers.find((l) => l.id === selectedLayerId);
      return layer ? layer.id : null;
    };

    setActionPlaying(true);
    try {
      for (const step of action.steps) {
        const payload = (step.payload ?? {}) as Record<string, unknown>;

        switch (step.type) {
          case 'set-opacity': {
            const id = resolveLayerId(payload);
            if (!id) break;
            const opacity = payload.opacity as number | undefined;
            if (opacity == null) break;
            get().setLayerOpacity(id, opacity);
            break;
          }
          case 'set-blend': {
            const id = resolveLayerId(payload);
            if (!id) break;
            const blendMode = payload.blendMode as BlendMode | undefined;
            if (!blendMode) break;
            get().setLayerBlendMode(id, blendMode);
            break;
          }
          case 'duplicate-layer': {
            const id = (payload.id as string | undefined) ?? resolveLayerId(payload);
            if (!id) break;
            get().duplicateLayer(id);
            break;
          }
          case 'move-layer': {
            const id = resolveLayerId(payload);
            if (!id) break;
            const layer = get().layers.find((l) => l.id === id);
            if (!layer) break;
            if (typeof payload.x === 'number' && typeof payload.y === 'number') {
              get().updateLayer(id, { x: payload.x, y: payload.y });
            } else {
              const dx = (payload.dx as number | undefined) ?? 0;
              const dy = (payload.dy as number | undefined) ?? 0;
              get().updateLayer(id, {
                x: Math.round(layer.x + dx),
                y: Math.round(layer.y + dy),
              });
            }
            break;
          }
          case 'transform-layer': {
            const id = resolveLayerId(payload);
            if (!id) break;
            const updates: Partial<EditorLayer> = {};
            if (typeof payload.x === 'number') updates.x = payload.x;
            if (typeof payload.y === 'number') updates.y = payload.y;
            if (typeof payload.rotation === 'number') updates.rotation = payload.rotation;
            if (typeof payload.scaleX === 'number') updates.scaleX = payload.scaleX;
            if (typeof payload.scaleY === 'number') updates.scaleY = payload.scaleY;
            if (typeof payload.skewX === 'number') updates.skewX = payload.skewX;
            if (typeof payload.skewY === 'number') updates.skewY = payload.skewY;
            if (Object.keys(updates).length > 0) get().updateLayer(id, updates);
            break;
          }
          case 'revive': {
            const layerId = resolveLayerId(payload);
            if (!layerId) break;
            await get().revivePhotoLayer(
              layerId,
              (payload.mode as ReviveMode | undefined) ?? 'natural',
              (payload.intensity as number | undefined) ?? 0.75,
              (payload.bakeNewLayer as boolean | undefined) ?? false
            );
            break;
          }
          case 'cleanup': {
            const layerId = resolveLayerId(payload);
            if (!layerId) break;
            await get().cleanPhotoLayer(
              layerId,
              (payload.mode as CleanupMode | undefined) ?? 'standard',
              (payload.intensity as number | undefined) ?? 0.7,
              (payload.bakeNewLayer as boolean | undefined) ?? true
            );
            break;
          }
          case 'desaturate': {
            const layerId = resolveLayerId(payload);
            if (!layerId) break;
            get().commitHistory('Desaturate');
            get().updateAdjustments(layerId, { grayscale: true });
            break;
          }
          case 'invert': {
            const layerId = resolveLayerId(payload);
            if (!layerId) break;
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
          case 'cloud-job': {
            const layerId = resolveLayerId(payload);
            if (!layerId) break;
            await get().runCloudAiJob(layerId, (payload.kind as AiJobKind) || 'cleanup', {
              intensity: payload.intensity as number | undefined,
              prompt: payload.prompt as string | undefined,
              style: payload.style as AiStylePreset | undefined,
              relight: payload.relight as AiRelightPreset | undefined,
              applyAsMask: payload.applyAsMask as boolean | undefined,
            });
            break;
          }
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
