import type { DocumentSlice } from './slices/documentSlice';
import type { HistorySlice } from './slices/historySlice';
import type { LayersSlice } from './slices/layersSlice';
import type { ToolsSlice } from './slices/toolsSlice';
import type { SelectionSlice } from './slices/selectionSlice';
import type { AdjustmentsSlice } from './slices/adjustmentsSlice';
import type { GuidesSlice } from './slices/guidesSlice';
import type { ActionsSlice } from './slices/actionsSlice';
import type { AISlice } from './slices/aiSlice';
import type { ProjectSlice } from './slices/projectSlice';
import type { UISlice } from './slices/uiSlice';

/** Full editor store shape: intersection of every domain slice. */
export type EditorStore =
  & DocumentSlice
  & HistorySlice
  & LayersSlice
  & ToolsSlice
  & SelectionSlice
  & AdjustmentsSlice
  & GuidesSlice
  & ActionsSlice
  & AISlice
  & ProjectSlice
  & UISlice;

/** Backwards-compatible alias for the previous monolithic state type name. */
export type EditorState = EditorStore;
