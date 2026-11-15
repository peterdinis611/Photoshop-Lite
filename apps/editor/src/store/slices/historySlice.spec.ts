import { create } from 'zustand';
import { describe, expect, it } from 'vitest';
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

describe('historySlice', () => {
  it('commitHistory pushes a snapshot and clears future', () => {
    const useStore = createTestStore();
    useStore.getState().commitHistory('Test');
    const s = useStore.getState();
    expect(s.past).toHaveLength(1);
    expect(s.past[0].name).toBe('Test');
    expect(s.future).toHaveLength(0);
  });

  it('undo restores prior canvas size; redo restores the mutated size', () => {
    const useStore = createTestStore();
    useStore.setState({ past: [], future: [], canvasWidth: 1200, canvasHeight: 800 });
    useStore.getState().commitHistory('Base');
    useStore.setState({ canvasWidth: 640, canvasHeight: 480 });

    useStore.getState().undo();
    expect(useStore.getState().canvasWidth).toBe(1200);
    expect(useStore.getState().canvasHeight).toBe(800);

    useStore.getState().redo();
    expect(useStore.getState().canvasWidth).toBe(640);
    expect(useStore.getState().canvasHeight).toBe(480);
  });
});

describe('guidesSlice via store', () => {
  it('adds and clears guides', () => {
    const useStore = createTestStore();
    const id = useStore.getState().addGuide('horizontal', 100);
    expect(useStore.getState().guides).toHaveLength(1);
    expect(useStore.getState().guides[0].id).toBe(id);
    useStore.getState().clearGuides();
    expect(useStore.getState().guides).toHaveLength(0);
  });
});
