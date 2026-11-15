import { create } from 'zustand';
import type { EditorStore } from './types';
import { createDocumentSlice } from './slices/documentSlice';
import { createHistorySlice } from './slices/historySlice';
import { createLayersSlice } from './slices/layersSlice';
import { createToolsSlice } from './slices/toolsSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createAdjustmentsSlice } from './slices/adjustmentsSlice';
import { createGuidesSlice } from './slices/guidesSlice';
import { createActionsSlice } from './slices/actionsSlice';
import { createAISlice } from './slices/aiSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createUISlice } from './slices/uiSlice';

export type { EditorStore, EditorState } from './types';

export const useEditorStore = create<EditorStore>()((...a) => ({
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
