import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { EditorLayer, ImageLayer, LottieLayer, TextLayer, ShapeLayer, DrawingLayer, PathLayer, PathAnchor, ShapeType, BlendMode, AdjustmentLayer, AdjustmentLayerKind, GradientLayer, GroupLayer } from '../../types/editor';
import { normalizeAnchors, pathBounds } from '../../utils/pathHelpers';
import { DEFAULT_ADJUSTMENTS, deepClone, DEFAULT_CURVES, DEFAULT_LEVELS, createLinearGradientDataUrl, createRadialGradientDataUrl } from '@photoshop-lite/editor-core';
import { exportDocumentToDataUrl } from '@photoshop-lite/editor-konva';
import { uniqueLayerName, makeId, ADJUSTMENT_LABELS, flattenPathLayer, loadImageElement } from '../helpers';
import { rasterizeLottieFrame } from '../../utils/lottieFiles';

export interface LayersSlice {
  layers: EditorLayer[];
  selectedLayerId: string | null;
  addAdjustmentLayer: (kind: AdjustmentLayerKind) => void;
  addGradientLayerFromDrag: (x1: number, y1: number, x2: number, y2: number) => void;
  convertSelectedToSmartObject: () => void;
  replaceSmartObjectSource: (src: string, width?: number, height?: number) => void;
  strokePathAsDrawing: () => void;
  placeGradientFill: (x1: number, y1: number, x2: number, y2: number) => void;
  addLayer: (layer: EditorLayer) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  updateLayer: (id: string, updates: Partial<EditorLayer>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  duplicateLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerBlendMode: (id: string, blendMode: BlendMode) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setClippingMask: (id: string, clipToId: string) => void;
  removeClippingMask: (id: string) => void;
  toggleLayerMask: (id: string) => void;
  paintLayerMask: (id: string, maskDataUrl: string) => void;
  addImageLayer: (src: string, name?: string, naturalWidth?: number, naturalHeight?: number) => void;
  addLottieLayer: (
    animationData: Record<string, unknown>,
    name?: string,
    naturalWidth?: number,
    naturalHeight?: number
  ) => void;
  bakeLottieLayer: (id?: string) => Promise<void>;
  addTextLayer: (position?: { x: number; y: number }) => void;
  addShapeLayer: (type?: ShapeType) => void;
  addPathLayer: (anchors: PathAnchor[], closed?: boolean) => void;
  addDrawingStroke: (layerId: string, stroke: { points: number[]; color: string; size: number; opacity: number; isEraser: boolean }) => void;
  nudgeSelectedLayer: (dx: number, dy: number) => void;
  mergeDownLayer: (id?: string) => Promise<void>;
  flattenVisibleLayers: () => Promise<void>;
  createGroupFromSelection: (ids?: string[]) => void;
  ungroupLayer: (id?: string) => void;
  toggleGroupExpanded: (id: string) => void;
  alignSelectedLayers: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
}

export const createLayersSlice: StateCreator<EditorStore, [], [], LayersSlice> = (set, get) => ({
  layers: [],

  selectedLayerId: null,

  addLayer: (layer) => {
    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
    }));
  },

  removeLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;

    get().commitHistory(`Delete ${layer.name}`);
    set((state) => {
      const newLayers = state.layers.filter((l) => l.id !== id);
      return {
        layers: newLayers,
        selectedLayerId:
          state.selectedLayerId === id
            ? newLayers.length > 0
              ? newLayers[newLayers.length - 1].id
              : null
            : state.selectedLayerId,
      };
    });
  },

  selectLayer: (id) => set({ selectedLayerId: id }),

  updateLayer: (id, updates) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? ({ ...l, ...updates } as EditorLayer) : l)),
    }));
  },

  reorderLayers: (fromIndex, toIndex) => {
    const { layers } = get();
    if (fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length) return;

    get().commitHistory('Reorder Layers');
    const newLayers = [...layers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);

    set({ layers: newLayers });
  },

  duplicateLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;

    get().commitHistory(`Duplicate ${layer.name}`);
    const duplicated: EditorLayer = {
      ...deepClone(layer),
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(`${layer.name} Copy`, get().layers),
      x: layer.x + 25,
      y: layer.y + 25,
    };

    set((state) => ({
      layers: [...state.layers, duplicated],
      selectedLayerId: duplicated.id,
    }));
  },

  toggleLayerVisibility: (id) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    }));
  },

  toggleLayerLock: (id) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    }));
  },

  renameLayer: (id, name) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    }));
  },

  setLayerBlendMode: (id, blendMode) => {
    get().commitHistory('Change Blend Mode');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)),
    }));
  },

  setLayerOpacity: (id, opacity) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
    }));
  },

  addImageLayer: (src, name = 'Image Layer', naturalWidth, naturalHeight) => {
    const state = get();
    let { canvasWidth, canvasHeight } = state;
    const w = Math.max(1, Math.round(naturalWidth || 600));
    const h = Math.max(1, Math.round(naturalHeight || 400));

    let targetW = w;
    let targetH = h;
    let x = 0;
    let y = 0;

    // First image opens as the document (supports large photos)
    if (state.layers.length === 0) {
      canvasWidth = w;
      canvasHeight = h;
      targetW = w;
      targetH = h;
      x = 0;
      y = 0;
      set({ canvasWidth, canvasHeight });
    } else {
      // Additional images fit inside the current canvas
      const maxAllowedW = canvasWidth * 0.85;
      const maxAllowedH = canvasHeight * 0.85;
      if (targetW > maxAllowedW || targetH > maxAllowedH) {
        const scale = Math.min(maxAllowedW / targetW, maxAllowedH / targetH);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }
      x = Math.round((canvasWidth - targetW) / 2);
      y = Math.round((canvasHeight - targetH) / 2);
    }

    const newLayer: ImageLayer = {
      id: `${Date.now()}_img_${Math.random().toString(36).substring(2, 6)}`,
      name,
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width: targetW,
      height: targetH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      src,
      originalSrc: src,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };

    get().commitHistory(`Add ${name}`);
    set((s) => ({
      layers: [...s.layers, newLayer],
      selectedLayerId: newLayer.id,
      isDocumentOpen: true,
    }));
  },

  addLottieLayer: (animationData, name = 'Lottie', naturalWidth, naturalHeight) => {
    const state = get();
    let { canvasWidth, canvasHeight } = state;
    const w = Math.max(1, Math.round(naturalWidth || Number(animationData.w) || 512));
    const h = Math.max(1, Math.round(naturalHeight || Number(animationData.h) || 512));

    let targetW = w;
    let targetH = h;
    let x = 0;
    let y = 0;

    if (state.layers.length === 0) {
      canvasWidth = w;
      canvasHeight = h;
      set({ canvasWidth, canvasHeight });
    } else {
      const maxAllowedW = canvasWidth * 0.85;
      const maxAllowedH = canvasHeight * 0.85;
      if (targetW > maxAllowedW || targetH > maxAllowedH) {
        const scale = Math.min(maxAllowedW / targetW, maxAllowedH / targetH);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }
      x = Math.round((canvasWidth - targetW) / 2);
      y = Math.round((canvasHeight - targetH) / 2);
    }

    const newLayer: LottieLayer = {
      id: `${Date.now()}_lottie_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(name, state.layers),
      type: 'lottie',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width: targetW,
      height: targetH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      animationData: structuredClone(animationData),
      sourceName: name,
      loop: true,
      playing: true,
      speed: 1,
      intrinsicWidth: w,
      intrinsicHeight: h,
    };

    get().commitHistory(`Add ${newLayer.name}`);
    set((s) => ({
      layers: [...s.layers, newLayer],
      selectedLayerId: newLayer.id,
      isDocumentOpen: true,
    }));
  },

  bakeLottieLayer: async (id) => {
    const layerId = id ?? get().selectedLayerId;
    const layer = get().layers.find((l) => l.id === layerId);
    if (!layer || layer.type !== 'lottie') return;

    try {
      const src = await rasterizeLottieFrame(
        layer.animationData,
        layer.width,
        layer.height
      );
      get().addImageLayer(src, `${layer.name} Frame`, layer.width, layer.height);
    } catch {
      /* caller may toast */
    }
  },

  addTextLayer: (position) => {
    const { canvasWidth, canvasHeight, textSettings } = get();
    const width = 240;
    const height = Math.max(40, Math.round(textSettings.fontSize * textSettings.lineHeight * 1.4));
    const x = position
      ? Math.round(position.x - width / 2)
      : Math.round(canvasWidth / 2 - width / 2);
    const y = position
      ? Math.round(position.y - height / 2)
      : Math.round(canvasHeight / 2 - height / 2);
    const newLayer: TextLayer = {
      id: `${Date.now()}_txt_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Text Layer',
      type: 'text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x,
      y,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      text: 'Double click to edit',
      fontFamily: textSettings.fontFamily,
      fontSize: textSettings.fontSize,
      fill: textSettings.fill,
      fontStyle: textSettings.fontStyle,
      textDecoration: 'none',
      align: textSettings.align,
      letterSpacing: textSettings.letterSpacing,
      lineHeight: textSettings.lineHeight,
      stroke: textSettings.stroke,
      strokeWidth: textSettings.strokeWidth,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 8,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowOpacity: 0.5,
      },
    };

    get().commitHistory('Add Text Layer');
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
      activeTool: 'select',
      isDocumentOpen: true,
    }));
  },

  addShapeLayer: (type = 'rectangle') => {
    const { canvasWidth, canvasHeight, shapeSettings } = get();
    const size = 180;
    const x = Math.round(canvasWidth / 2 - size / 2);
    const y = Math.round(canvasHeight / 2 - size / 2);

    const newLayer: ShapeLayer = {
      id: `${Date.now()}_shape_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(
        `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        get().layers
      ),
      type: 'shape',
      shapeType: type,
      visible: true,
      locked: false,
      opacity: shapeSettings.opacity,
      blendMode: 'source-over',
      x,
      y,
      width: size,
      height: size,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      fill: shapeSettings.fill,
      stroke: shapeSettings.stroke,
      strokeWidth: shapeSettings.strokeWidth,
      cornerRadius:
        type === 'rectangle' || type === 'callout' ? shapeSettings.cornerRadius : 0,
      sides: type === 'polygon' ? 6 : type === 'star' ? 5 : undefined,
      innerRadius:
        type === 'ring' || type === 'arc' ? 0.5 : type === 'star' ? 0.45 : undefined,
      angle: type === 'arc' ? 270 : type === 'wedge' ? 60 : undefined,
      points:
        type === 'arrow'
          ? [0, size / 2, size, size / 2]
          : type === 'line'
            ? [0, 0, size, size]
            : undefined,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 10,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowOpacity: 0.35,
      },
    };

    get().commitHistory(`Add ${type} Shape`);
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
      activeTool: 'select',
      isDocumentOpen: true,
    }));
  },

  addPathLayer: (anchors, closed = false) => {
    if (anchors.length < 2) return;
    const { penSettings } = get();
    const bounds = pathBounds(anchors, Math.max(8, penSettings.strokeWidth * 2));
    const localAnchors = normalizeAnchors(anchors, bounds.x, bounds.y);

    const newLayer: PathLayer = {
      id: `${Date.now()}_path_${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueLayerName(closed ? 'Closed Path' : 'Path', get().layers),
      type: 'path',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchors: localAnchors,
      closed,
      fill: penSettings.fill,
      stroke: penSettings.stroke,
      strokeWidth: penSettings.strokeWidth,
      styles: {
        shadowColor: '#000000',
        shadowBlur: 6,
        shadowOffsetX: 1,
        shadowOffsetY: 2,
        shadowOpacity: 0.25,
      },
    };

    get().commitHistory(closed ? 'Add Closed Path' : 'Add Path');
    set((state) => ({
      layers: [...state.layers, newLayer],
      selectedLayerId: newLayer.id,
    }));
  },

  addDrawingStroke: (layerId, stroke) => {
    set((state) => {
      const drawingLayer = state.layers.find((l) => l.id === layerId) as DrawingLayer | undefined;
      let newLayers = [...state.layers];

      if (!drawingLayer || drawingLayer.type !== 'drawing') {
        const newDrawLayer: DrawingLayer = {
          id: `${Date.now()}_draw`,
          name: 'Brush Drawing',
          type: 'drawing',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          width: state.canvasWidth,
          height: state.canvasHeight,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          strokes: [stroke],
        };
        newLayers.push(newDrawLayer);
        return {
          layers: newLayers,
          selectedLayerId: newDrawLayer.id,
        };
      }

      newLayers = newLayers.map((l) =>
        l.id === layerId && l.type === 'drawing'
          ? {
              ...l,
              strokes: [...l.strokes, stroke],
            }
          : l
      );

      return { layers: newLayers };
    });
  },

  setClippingMask: (id, clipToId) => {
    get().commitHistory('Set Clipping Mask');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, clippingMaskToId: clipToId } : l)),
    }));
  },

  removeClippingMask: (id) => {
    get().commitHistory('Remove Clipping Mask');
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, clippingMaskToId: undefined } : l)),
    }));
  },

  toggleLayerMask: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const hasLayerMask = !!layer.hasLayerMask;
    get().commitHistory(hasLayerMask ? 'Remove Layer Mask' : 'Add Layer Mask');
    if (!hasLayerMask) {
      // Create a blank white (reveal all) mask as a base64 data URL
      const canvas = document.createElement('canvas');
      canvas.width = layer.width || 100;
      canvas.height = layer.height || 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const maskSrc = canvas.toDataURL('image/png');
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, hasLayerMask: true, layerMaskSrc: maskSrc } : l
        ),
      }));
    } else {
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, hasLayerMask: false, layerMaskSrc: undefined } : l
        ),
      }));
    }
  },

  paintLayerMask: (id, maskDataUrl) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, layerMaskSrc: maskDataUrl } : l
      ),
    }));
  },

  nudgeSelectedLayer: (dx, dy) => {
    const { selectedLayerId, layers } = get();
    if (!selectedLayerId) return;
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer || layer.locked) return;
    get().updateLayer(selectedLayerId, {
      x: Math.round(layer.x + dx),
      y: Math.round(layer.y + dy),
    });
  },

  addAdjustmentLayer: (kind) => {
    const { layers, selectedLayerId, canvasWidth, canvasHeight } = get();
    const label = ADJUSTMENT_LABELS[kind];
    const count = layers.filter((l) => l.type === 'adjustment' && l.kind === kind).length;

    const adjustments: AdjustmentLayer['adjustments'] = { ...DEFAULT_ADJUSTMENTS };
    if (kind === 'curves') adjustments.curves = deepClone(DEFAULT_CURVES);
    if (kind === 'levels') adjustments.levels = { ...DEFAULT_LEVELS };
    if (kind === 'invert') adjustments.invert = true;
    if (kind === 'grayscale') adjustments.grayscale = true;

    const layer: AdjustmentLayer = {
      id: makeId('adj'),
      name: uniqueLayerName(`${label} ${count + 1}`, layers),
      type: 'adjustment',
      kind,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      adjustments,
      affectedChannel: 'rgb',
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => {
      const selectedIdx = state.layers.findIndex((l) => l.id === selectedLayerId);
      const insertAt = selectedIdx >= 0 ? selectedIdx + 1 : state.layers.length;
      const next = [...state.layers];
      next.splice(insertAt, 0, layer);
      return { layers: next, selectedLayerId: layer.id };
    });
  },

  addGradientLayerFromDrag: (x1, y1, x2, y2) => {
    const { layers, canvasWidth, canvasHeight, gradientSettings } = get();
    if (Math.hypot(x2 - x1, y2 - y1) < 2) return;

    const layer: GradientLayer = {
      id: makeId('grad'),
      name: uniqueLayerName('Gradient', layers),
      type: 'gradient',
      visible: true,
      locked: false,
      opacity: gradientSettings.opacity,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      gradientType: gradientSettings.gradientType,
      colorStops: deepClone(gradientSettings.colorStops),
      angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      // Layer sits at the document origin, so layer-local === document coordinates
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
      isDocumentOpen: true,
    }));
  },

  convertSelectedToSmartObject: () => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image' || layer.smartObject) return;

    get().commitHistory('Convert to Smart Object');
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layer.id && l.type === 'image'
          ? { ...l, smartObject: true, smartObjectSrc: l.originalSrc || l.src }
          : l
      ),
    }));
  },

  replaceSmartObjectSource: (src, width, height) => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image' || !layer.smartObject) return;

    const updates: Partial<ImageLayer> = { src, originalSrc: src, smartObjectSrc: src };
    if (width && height && width > 0 && height > 0) {
      // Contain-fit the new content inside the layer's current on-canvas box
      const boxW = layer.width * Math.abs(layer.scaleX);
      const boxH = layer.height * Math.abs(layer.scaleY);
      const k = Math.min(boxW / width, boxH / height);
      updates.width = Math.max(1, Math.round(width * k));
      updates.height = Math.max(1, Math.round(height * k));
      updates.scaleX = layer.scaleX < 0 ? -1 : 1;
      updates.scaleY = layer.scaleY < 0 ? -1 : 1;
    }

    get().commitHistory('Replace Smart Object Contents');
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layer.id && l.type === 'image' ? { ...l, ...updates } : l
      ),
    }));
  },

  strokePathAsDrawing: () => {
    const { layers, selectedLayerId, canvasWidth, canvasHeight, brushSettings } = get();
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer || layer.type !== 'path') return;

    const points = flattenPathLayer(layer);
    if (points.length < 4) return;
    if (layer.closed) points.push(points[0], points[1]);

    const hasOwnStroke =
      layer.strokeWidth > 0 && !!layer.stroke && layer.stroke !== 'transparent';
    const drawing: DrawingLayer = {
      id: makeId('draw'),
      name: uniqueLayerName('Path Stroke', layers),
      type: 'drawing',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      strokes: [
        {
          points,
          color: hasOwnStroke ? layer.stroke : brushSettings.color,
          size: hasOwnStroke ? Math.max(1, layer.strokeWidth) : brushSettings.size,
          opacity: hasOwnStroke ? 1 : brushSettings.opacity,
          isEraser: false,
          hardness: brushSettings.hardness,
        },
      ],
    };

    get().commitHistory('Stroke Path');
    set((state) => {
      const idx = state.layers.findIndex((l) => l.id === layer.id);
      const next = [...state.layers];
      next.splice(idx >= 0 ? idx + 1 : next.length, 0, drawing);
      return { layers: next, selectedLayerId: drawing.id };
    });
  },

  placeGradientFill: (x1, y1, x2, y2) => {
    const { layers, canvasWidth, canvasHeight, gradientSettings } = get();
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 2) return;

    const w = Math.max(1, Math.round(canvasWidth));
    const h = Math.max(1, Math.round(canvasHeight));
    const src =
      gradientSettings.gradientType === 'radial'
        ? createRadialGradientDataUrl(w, h, {
            cx: x1,
            cy: y1,
            r: dist,
            colorStops: gradientSettings.colorStops,
          })
        : createLinearGradientDataUrl(w, h, {
            x1,
            y1,
            x2,
            y2,
            colorStops: gradientSettings.colorStops,
          });

    const layer: ImageLayer = {
      id: makeId('gradfill'),
      name: uniqueLayerName('Gradient Fill', layers),
      type: 'image',
      visible: true,
      locked: false,
      opacity: gradientSettings.opacity,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      src,
      originalSrc: src,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };

    get().commitHistory(`Add ${layer.name}`);
    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerId: layer.id,
      isDocumentOpen: true,
    }));
  },

  mergeDownLayer: async (id) => {
    const { layers, selectedLayerId, canvasWidth, canvasHeight } = get();
    const targetId = id || selectedLayerId;
    if (!targetId) return;
    const idx = layers.findIndex((l) => l.id === targetId);
    if (idx <= 0) return;
    const upper = layers[idx];
    const lower = layers[idx - 1];
    if (upper.type === 'group' || lower.type === 'group') return;
    if (upper.type !== 'image' || lower.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Merge Down currently supports image layers only',
        },
      });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawImageLayer = async (layer: ImageLayer) => {
      const img = await loadImageElement(layer.src);
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(layer.x + (layer.width * layer.scaleX) / 2, layer.y + (layer.height * layer.scaleY) / 2);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scaleX, layer.scaleY);
      ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();
    };

    await drawImageLayer(lower);
    await drawImageLayer(upper);
    const mergedSrc = canvas.toDataURL('image/png');

    get().commitHistory('Merge Down');
    const merged: ImageLayer = {
      ...deepClone(lower),
      id: makeId('merge'),
      name: uniqueLayerName(`${lower.name} + ${upper.name}`, layers),
      src: mergedSrc,
      originalSrc: mergedSrc,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      hasLayerMask: false,
      layerMaskSrc: undefined,
    };

    set((state) => {
      const next = [...state.layers];
      next.splice(idx - 1, 2, merged);
      return { layers: next, selectedLayerId: merged.id };
    });
  },

  flattenVisibleLayers: async () => {
    const { canvasWidth, canvasHeight, backgroundColor, layers } = get();
    if (layers.length === 0) return;
    const dataUrl = await exportDocumentToDataUrl({
      format: 'png',
      quality: 1,
      scale: 1,
      transparentBackground: backgroundColor === 'transparent',
      backgroundColor: backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
      canvasWidth,
      canvasHeight,
    });
    get().commitHistory('Flatten Image');
    const flat: ImageLayer = {
      id: makeId('flat'),
      name: 'Flattened',
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      src: dataUrl,
      originalSrc: dataUrl,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    set({ layers: [flat], selectedLayerId: flat.id });
  },

  createGroupFromSelection: (ids) => {
    const { layers, selectedLayerId } = get();
    const targetIds = ids?.length ? ids : selectedLayerId ? [selectedLayerId] : [];
    if (targetIds.length === 0) return;
    const members = layers.filter((l) => targetIds.includes(l.id) && l.type !== 'group');
    if (members.length === 0) return;

    get().commitHistory('Group Layers');
    const groupId = makeId('group');
    const group: GroupLayer = {
      id: groupId,
      name: uniqueLayerName('Group', layers),
      type: 'group',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      expanded: true,
      childIds: members.map((m) => m.id),
    };

    set((state) => ({
      layers: [
        ...state.layers.map((l) =>
          targetIds.includes(l.id) ? { ...l, parentGroupId: groupId } : l
        ),
        group,
      ],
      selectedLayerId: groupId,
    }));
  },

  ungroupLayer: (id) => {
    const { layers, selectedLayerId } = get();
    const groupId = id || selectedLayerId;
    if (!groupId) return;
    const group = layers.find((l) => l.id === groupId);
    if (!group || group.type !== 'group') return;

    get().commitHistory('Ungroup');
    set((state) => ({
      layers: state.layers
        .filter((l) => l.id !== groupId)
        .map((l) =>
          l.parentGroupId === groupId ? { ...l, parentGroupId: null } : l
        ),
      selectedLayerId: group.childIds[0] || null,
    }));
  },

  toggleGroupExpanded: (id) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id && l.type === 'group' ? { ...l, expanded: !l.expanded } : l
      ),
    }));
  },

  alignSelectedLayers: (mode) => {
    const { layers, selectedLayerId } = get();
    if (!selectedLayerId) return;
    const selected = layers.find((l) => l.id === selectedLayerId);
    if (!selected || selected.type === 'group') return;
    const siblings = layers.filter(
      (l) =>
        l.type !== 'group' &&
        (l.parentGroupId || null) === (selected.parentGroupId || null)
    );
    if (siblings.length < 2) return;

    const ref = selected;
    get().commitHistory(`Align ${mode}`);
    set((state) => ({
      layers: state.layers.map((l) => {
        if (l.id === ref.id || l.type === 'group') return l;
        if ((l.parentGroupId || null) !== (ref.parentGroupId || null)) return l;
        const w = l.width * (l.scaleX || 1);
        const h = l.height * (l.scaleY || 1);
        const rw = ref.width * (ref.scaleX || 1);
        const rh = ref.height * (ref.scaleY || 1);
        switch (mode) {
          case 'left':
            return { ...l, x: ref.x };
          case 'center':
            return { ...l, x: ref.x + rw / 2 - w / 2 };
          case 'right':
            return { ...l, x: ref.x + rw - w };
          case 'top':
            return { ...l, y: ref.y };
          case 'middle':
            return { ...l, y: ref.y + rh / 2 - h / 2 };
          case 'bottom':
            return { ...l, y: ref.y + rh - h };
          default:
            return l;
        }
      }),
    }));
  },
});
