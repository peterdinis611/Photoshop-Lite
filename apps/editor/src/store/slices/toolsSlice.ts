import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import { DEFAULT_PEN_SETTINGS, DEFAULT_SHAPE_SETTINGS, DEFAULT_TEXT_SETTINGS, DEFAULT_GRADIENT_SETTINGS, DEFAULT_TONE_BRUSH, type ToolType, type ShapeType, type BrushSettings, type PenSettings, type ShapeSettings, type TextSettings, type CropSettings, type MarqueeMode, type GradientSettings, type ToneBrushSettings, type TransformMode } from '../../types/editor';
import { deepClone, type LiquifyMode } from '@photoshop-lite/editor-core';

export interface LiquifySettings {
  mode: LiquifyMode;
  /** 0-1 */
  strength: number;
}

export interface ToolsSlice {
  activeTool: ToolType;
  activeShapeType: ShapeType;
  brushSettings: BrushSettings;
  penSettings: PenSettings;
  shapeSettings: ShapeSettings;
  textSettings: TextSettings;
  cropSettings: CropSettings;
  marqueeMode: MarqueeMode;
  wandTolerance: number;
  gradientSettings: GradientSettings;
  updateGradientSettings: (settings: Partial<GradientSettings>) => void;
  toneBrushSettings: ToneBrushSettings;
  updateToneBrushSettings: (settings: Partial<ToneBrushSettings>) => void;
  liquifySettings: LiquifySettings;
  updateLiquifySettings: (settings: Partial<LiquifySettings>) => void;
  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveShapeType: (shape: ShapeType) => void;
  setMarqueeMode: (mode: MarqueeMode) => void;
  setWandTolerance: (tolerance: number) => void;
  updateBrushSettings: (settings: Partial<BrushSettings>) => void;
  updatePenSettings: (settings: Partial<PenSettings>) => void;
  updateShapeSettings: (settings: Partial<ShapeSettings>) => void;
  updateTextSettings: (settings: Partial<TextSettings>) => void;
  setCropSettings: (settings: Partial<CropSettings>) => void;
  cancelCrop: () => void;
}

export const createToolsSlice: StateCreator<EditorStore, [], [], ToolsSlice> = (set, get) => ({
  activeTool: 'select',

  activeShapeType: 'rectangle',

  marqueeMode: 'rect',

  wandTolerance: 36,

  brushSettings: {
    size: 24,
    color: '#d4923a',
    opacity: 1,
    hardness: 0.8,
    flow: 1,
    refineMode: 'erase',
  },

  penSettings: { ...DEFAULT_PEN_SETTINGS },

  shapeSettings: { ...DEFAULT_SHAPE_SETTINGS },

  textSettings: { ...DEFAULT_TEXT_SETTINGS },

  cropSettings: {
    active: false,
    aspect: 'free',
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    rotation: 0,
  },

  gradientSettings: deepClone(DEFAULT_GRADIENT_SETTINGS),

  toneBrushSettings: { ...DEFAULT_TONE_BRUSH },

  liquifySettings: { mode: 'push', strength: 1 },

  transformMode: 'free',

  setActiveTool: (tool) => {
    if (tool === 'crop') {
      const { canvasWidth, canvasHeight, selectedLayerId, layers } = get();
      const selected = layers.find((l) => l.id === selectedLayerId);
      // Prefer the selected image bounds so crop feels like “crop this photo”
      if (selected?.type === 'image') {
        const w = Math.max(20, Math.round(selected.width * Math.abs(selected.scaleX)));
        const h = Math.max(20, Math.round(selected.height * Math.abs(selected.scaleY)));
        const x = Math.round(
          Math.max(0, Math.min(selected.x, canvasWidth - Math.min(w, canvasWidth)))
        );
        const y = Math.round(
          Math.max(0, Math.min(selected.y, canvasHeight - Math.min(h, canvasHeight)))
        );
        set({
          activeTool: 'crop',
          cropSettings: {
            active: true,
            aspect: 'free',
            x,
            y,
            width: Math.min(w, canvasWidth - x),
            height: Math.min(h, canvasHeight - y),
            rotation: 0,
          },
        });
      } else {
        set({
          activeTool: 'crop',
          cropSettings: {
            active: true,
            aspect: 'free',
            x: Math.round(canvasWidth * 0.05),
            y: Math.round(canvasHeight * 0.05),
            width: Math.round(canvasWidth * 0.9),
            height: Math.round(canvasHeight * 0.9),
            rotation: 0,
          },
        });
      }
    } else {
      set({
        activeTool: tool,
        cropSettings: { ...get().cropSettings, active: false },
      });
    }
  },

  setActiveShapeType: (shape) => set({ activeShapeType: shape }),

  setMarqueeMode: (mode) => set({ marqueeMode: mode }),

  setWandTolerance: (tolerance) =>
    set({ wandTolerance: Math.max(0, Math.min(128, tolerance)) }),

  updateBrushSettings: (settings) =>
    set((state) => ({ brushSettings: { ...state.brushSettings, ...settings } })),

  updatePenSettings: (settings) =>
    set((state) => ({ penSettings: { ...state.penSettings, ...settings } })),

  updateShapeSettings: (settings) =>
    set((state) => ({ shapeSettings: { ...state.shapeSettings, ...settings } })),

  updateTextSettings: (settings) =>
    set((state) => ({ textSettings: { ...state.textSettings, ...settings } })),

  setCropSettings: (settings) =>
    set((state) => ({ cropSettings: { ...state.cropSettings, ...settings } })),

  cancelCrop: () => {
    set((state) => ({
      activeTool: 'select',
      cropSettings: { ...state.cropSettings, active: false },
    }));
  },

  updateGradientSettings: (settings) =>
    set((state) => ({ gradientSettings: { ...state.gradientSettings, ...settings } })),

  updateToneBrushSettings: (settings) =>
    set((state) => ({ toneBrushSettings: { ...state.toneBrushSettings, ...settings } })),

  updateLiquifySettings: (settings) =>
    set((state) => ({ liquifySettings: { ...state.liquifySettings, ...settings } })),

  setTransformMode: (mode) => set({ transformMode: mode }),
});
