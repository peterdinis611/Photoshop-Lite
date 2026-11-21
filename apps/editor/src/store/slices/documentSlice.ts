import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { Artboard } from '../../types/editor';
import { makeId } from '../helpers';

export interface DocumentSlice {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  artboards: Artboard[];
  activeArtboardId: string | null;
  addArtboard: (artboard?: Partial<Omit<Artboard, 'id'>>) => string;
  setActiveArtboard: (id: string | null) => void;
  updateArtboard: (id: string, updates: Partial<Omit<Artboard, 'id'>>) => void;
  removeArtboard: (id: string) => void;
  /** False until New Document / place image / open project — drives empty-stage overlay */
  isDocumentOpen: boolean;
  setCanvasDimensions: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  createBlankDocument: (width: number, height: number, backgroundColor: string) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetView: () => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
}

export const createDocumentSlice: StateCreator<EditorStore, [], [], DocumentSlice> = (set, get) => ({
  canvasWidth: 1200,

  canvasHeight: 800,

  backgroundColor: 'transparent',

  zoom: 1,

  pan: { x: 0, y: 0 },

  showGrid: false,

  showRulers: true,

  artboards: [],

  activeArtboardId: null,

  isDocumentOpen: false,

  setCanvasDimensions: (width, height) => {
    get().commitHistory(`Resize Canvas to ${width}x${height}`);
    set({ canvasWidth: width, canvasHeight: height });
  },

  setBackgroundColor: (color) => {
    get().commitHistory('Change Background Color');
    set({ backgroundColor: color });
  },

  createBlankDocument: (width, height, backgroundColor) => {
    const w = Math.max(50, Math.min(8000, Math.round(width) || 1200));
    const h = Math.max(50, Math.min(8000, Math.round(height) || 800));
    set({
      canvasWidth: w,
      canvasHeight: h,
      backgroundColor,
      layers: [],
      selectedLayerId: null,
      marqueeSelection: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      isDocumentOpen: true,
      isNewCanvasModalOpen: false,
      projectTitle: 'Untitled plate',
      cloudProjectId: null,
      activeTool: 'select',
      aiStatus: {
        isProcessing: false,
        action: null,
        progress: 0,
        statusText: '',
      },
    });
  },

  setZoom: (zoom) => {
    set((state) => ({
      zoom: typeof zoom === 'function' ? Math.max(0.1, Math.min(8, zoom(state.zoom))) : Math.max(0.1, Math.min(8, zoom)),
    }));
  },

  setPan: (pan) => {
    set((state) => ({
      pan: typeof pan === 'function' ? pan(state.pan) : pan,
    }));
  },

  resetView: () => {
    set({ zoom: 1, pan: { x: 0, y: 0 } });
  },

  fitToScreen: (containerWidth, containerHeight) => {
    const { canvasWidth, canvasHeight } = get();
    const padding = 60;
    const availW = Math.max(100, containerWidth - padding * 2);
    const availH = Math.max(100, containerHeight - padding * 2);
    const scale = Math.min(availW / canvasWidth, availH / canvasHeight, 1.5);
    const safeScale = Math.max(0.1, Number(scale.toFixed(2)));

    const panX = Math.round((containerWidth - canvasWidth * safeScale) / 2);
    const panY = Math.round((containerHeight - canvasHeight * safeScale) / 2);

    set({ zoom: safeScale, pan: { x: panX, y: panY } });
  },

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),

  addArtboard: (artboard = {}) => {
    const { artboards, canvasWidth, canvasHeight } = get();
    const last = artboards[artboards.length - 1];
    const names = new Set(artboards.map((a) => a.name));
    let n = artboards.length + 1;
    while (names.has(`Artboard ${n}`)) n += 1;

    const created: Artboard = {
      id: makeId('artboard'),
      name: `Artboard ${n}`,
      x: last ? last.x + last.width + 80 : 0,
      y: last ? last.y : 0,
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      ...artboard,
    };
    set((state) => ({
      artboards: [...state.artboards, created],
      activeArtboardId: created.id,
    }));
    return created.id;
  },

  setActiveArtboard: (id) => set({ activeArtboardId: id }),

  updateArtboard: (id, updates) =>
    set((state) => ({
      artboards: state.artboards.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeArtboard: (id) =>
    set((state) => {
      const artboards = state.artboards.filter((a) => a.id !== id);
      return {
        artboards,
        activeArtboardId:
          state.activeArtboardId === id
            ? (artboards[artboards.length - 1]?.id ?? null)
            : state.activeArtboardId,
      };
    }),
});
