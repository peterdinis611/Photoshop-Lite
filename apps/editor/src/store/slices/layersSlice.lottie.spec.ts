import { create } from 'zustand';
import { describe, expect, it, vi } from 'vitest';
import { createHistorySlice } from './historySlice';
import { createDocumentSlice } from './documentSlice';
import { createLayersSlice } from './layersSlice';
import type { EditorStore } from '../types';
import { createToolsSlice } from './toolsSlice';
import { createSelectionSlice } from './selectionSlice';
import { createAdjustmentsSlice } from './adjustmentsSlice';
import { createGuidesSlice } from './guidesSlice';
import { createActionsSlice } from './actionsSlice';
import { createAISlice } from './aiSlice';
import { createProjectSlice } from './projectSlice';
import { createUISlice } from './uiSlice';

vi.mock('../../utils/lottieFiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/lottieFiles')>();
  return {
    ...actual,
    rasterizeLottieFrame: vi.fn(async () => 'blob:baked-frame'),
  };
});

function createTestStore() {
  return create<EditorStore>()((...a) => ({
    ...createDocumentSlice(...a),
    ...createHistorySlice(...a),
    ...createLayersSlice(...a),
    ...createToolsSlice(...a),
    ...createSelectionSlice(...a),
    ...createAdjustmentsSlice(...a),
    ...createGuidesSlice(...a),
    ...createActionsSlice(...a),
    ...createAISlice(...a),
    ...createProjectSlice(...a),
    ...createUISlice(...a),
  }));
}

const SAMPLE_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 100,
  layers: [{ ind: 1, ty: 4, nm: 'Shape' }],
};

describe('layersSlice Lottie', () => {
  it('addLottieLayer sizes the document on first layer', () => {
    const useStore = createTestStore();
    useStore.getState().addLottieLayer(SAMPLE_LOTTIE, 'Anim', 200, 100);
    const state = useStore.getState();
    expect(state.canvasWidth).toBe(200);
    expect(state.canvasHeight).toBe(100);
    expect(state.isDocumentOpen).toBe(true);
    const layer = state.layers.find((l) => l.type === 'lottie');
    expect(layer).toMatchObject({
      type: 'lottie',
      name: 'Anim',
      width: 200,
      height: 100,
      playing: true,
      loop: true,
      speed: 1,
    });
    expect(state.selectedLayerId).toBe(layer?.id);
  });

  it('bakeLottieLayer creates an image layer from the frame', async () => {
    const useStore = createTestStore();
    useStore.getState().addLottieLayer(SAMPLE_LOTTIE, 'Anim', 200, 100);
    const lottieId = useStore.getState().selectedLayerId!;
    await useStore.getState().bakeLottieLayer(lottieId);
    const images = useStore.getState().layers.filter((l) => l.type === 'image');
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images.some((l) => l.src === 'blob:baked-frame')).toBe(true);
  });
});
