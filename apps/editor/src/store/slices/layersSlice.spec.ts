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
import type { ImageLayer } from '@photoshop-lite/shared-types';

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

function fakeImage(id: string, name: string): ImageLayer {
  return {
    id,
    name,
    type: 'image',
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
  };
}

describe('layersSlice groups', () => {
  it('createGroupFromSelection wraps layers and sets parentGroupId', () => {
    const useStore = createTestStore();
    const a = fakeImage('img_a', 'A');
    const b = fakeImage('img_b', 'B');
    useStore.setState({ layers: [a, b], selectedLayerId: 'img_a', past: [], future: [] });

    useStore.getState().createGroupFromSelection(['img_a', 'img_b']);
    const state = useStore.getState();
    const group = state.layers.find((l) => l.type === 'group');
    expect(group).toBeDefined();
    if (!group || group.type !== 'group') throw new Error('expected group');
    expect(group.childIds).toEqual(['img_a', 'img_b']);
    expect(state.selectedLayerId).toBe(group.id);
    expect(state.layers.find((l) => l.id === 'img_a')?.parentGroupId).toBe(group.id);
    expect(state.layers.find((l) => l.id === 'img_b')?.parentGroupId).toBe(group.id);
  });

  it('ungroupLayer restores children and removes the group', () => {
    const useStore = createTestStore();
    const a = fakeImage('img_a', 'A');
    useStore.setState({ layers: [a], selectedLayerId: 'img_a', past: [], future: [] });
    useStore.getState().createGroupFromSelection(['img_a']);
    const groupId = useStore.getState().selectedLayerId!;

    useStore.getState().ungroupLayer(groupId);
    const state = useStore.getState();
    expect(state.layers.some((l) => l.type === 'group')).toBe(false);
    expect(state.layers.find((l) => l.id === 'img_a')?.parentGroupId ?? null).toBeNull();
    expect(state.selectedLayerId).toBe('img_a');
  });

  it('alignSelectedLayers left-aligns siblings to the selected layer', () => {
    const useStore = createTestStore();
    const a = { ...fakeImage('img_a', 'A'), x: 40 };
    const b = { ...fakeImage('img_b', 'B'), x: 120 };
    useStore.setState({ layers: [a, b], selectedLayerId: 'img_a', past: [], future: [] });

    useStore.getState().alignSelectedLayers('left');
    expect(useStore.getState().layers.find((l) => l.id === 'img_b')?.x).toBe(40);
  });
});
