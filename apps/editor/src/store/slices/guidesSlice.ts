import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { Guide } from '../../types/editor';
import { makeId } from '../helpers';

export interface GuidesSlice {
  guides: Guide[];
  snapToGuides: boolean;
  addGuide: (orientation: Guide['orientation'], position: number) => string;
  removeGuide: (id: string) => void;
  clearGuides: () => void;
  setSnapToGuides: (snap: boolean) => void;
}

export const createGuidesSlice: StateCreator<EditorStore, [], [], GuidesSlice> = (set) => ({
  guides: [],

  snapToGuides: true,

  addGuide: (orientation, position) => {
    const guide: Guide = { id: makeId('guide'), orientation, position: Math.round(position) };
    set((state) => ({ guides: [...state.guides, guide] }));
    return guide.id;
  },

  removeGuide: (id) => set((state) => ({ guides: state.guides.filter((g) => g.id !== id) })),

  clearGuides: () => set({ guides: [] }),

  setSnapToGuides: (snap) => set({ snapToGuides: snap }),
});
