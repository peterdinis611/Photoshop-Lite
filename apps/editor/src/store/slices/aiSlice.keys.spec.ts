import { create } from 'zustand';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('aiSlice API keys', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('starts with empty session keys', () => {
    const useStore = createTestStore();
    expect(useStore.getState().removeBgApiKey).toBe('');
    expect(useStore.getState().replicateApiKey).toBe('');
  });

  it('keeps keys in memory only — never writes localStorage', () => {
    localStorage.setItem('px_remove_bg_key', 'legacy');
    localStorage.setItem('px_replicate_key', 'r8_legacy');

    const useStore = createTestStore();
    useStore.getState().setApiKeys({
      removeBgApiKey: 'session-rem',
      replicateApiKey: 'r8_session',
    });

    expect(useStore.getState().removeBgApiKey).toBe('session-rem');
    expect(useStore.getState().replicateApiKey).toBe('r8_session');
    expect(localStorage.getItem('px_remove_bg_key')).toBeNull();
    expect(localStorage.getItem('px_replicate_key')).toBeNull();
  });
});
