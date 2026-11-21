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
import { DEFAULT_PLATE_TITLE } from '../../utils/plateTitle';

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

describe('projectSlice title', () => {
  it('defaults to Untitled plate', () => {
    const useStore = createTestStore();
    expect(useStore.getState().projectTitle).toBe(DEFAULT_PLATE_TITLE);
  });

  it('setProjectTitle updates the plate name', () => {
    const useStore = createTestStore();
    useStore.getState().setProjectTitle('Night shoot');
    expect(useStore.getState().projectTitle).toBe('Night shoot');
  });

  it('new blank document resets title to Untitled plate', () => {
    const useStore = createTestStore();
    useStore.getState().setProjectTitle('Keep me');
    useStore.getState().createBlankDocument(800, 600, '#000000');
    expect(useStore.getState().projectTitle).toBe(DEFAULT_PLATE_TITLE);
  });
});
