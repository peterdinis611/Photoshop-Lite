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

vi.mock('@photoshop-lite/editor-konva', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@photoshop-lite/editor-konva')>();
  return {
    ...actual,
    clearKonvaImageCache: vi.fn(),
  };
});

vi.mock('../../utils/draftAutosave', () => ({
  clearDraft: vi.fn(async () => undefined),
}));

import { clearKonvaImageCache } from '@photoshop-lite/editor-konva';

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

describe('projectSlice loadProject', () => {
  it('restores canvas + layers and clears image cache', () => {
    const useStore = createTestStore();
    useStore.getState().loadProject({
      version: '1.0',
      title: 'Restored',
      canvasWidth: 1200,
      canvasHeight: 800,
      backgroundColor: '#101010',
      layers: [
        {
          id: 'img1',
          type: 'image',
          name: 'Plate',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          src: 'data:image/png;base64,aa',
          originalSrc: 'data:image/png;base64,aa',
          adjustments: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            exposure: 0,
            temperature: 0,
            tint: 0,
            highlights: 0,
            shadows: 0,
            vibrance: 0,
            hue: 0,
          },
        },
      ],
      savedAt: new Date().toISOString(),
    });

    const state = useStore.getState();
    expect(clearKonvaImageCache).toHaveBeenCalled();
    expect(state.projectTitle).toBe('Restored');
    expect(state.canvasWidth).toBe(1200);
    expect(state.layers).toHaveLength(1);
    expect(state.selectedLayerId).toBeNull();
    expect(state.isDocumentOpen).toBe(true);
    expect(state.activeTool).toBe('select');
    expect(state.past).toEqual([]);
  });
});
