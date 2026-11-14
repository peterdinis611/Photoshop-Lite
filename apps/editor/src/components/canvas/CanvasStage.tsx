import React, { useRef, useEffect, useEffectEvent, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, FastLayer, Transformer, Rect, Line, Ellipse, Arrow, Circle, Star, RegularPolygon, Arc, Ring, Wedge, Text as KonvaText, Path as KonvaPath } from 'react-konva';
import Konva from 'konva';
import { useAsyncThrottledCallback, useThrottledCallback } from '@tanstack/react-pacer';
import { registerStage, listeningPolicy } from '@photoshop-lite/editor-konva';
import {
  applyToneBrushToImage,
  applyHealingBrushToImage,
  applyPatchToImage,
} from '@photoshop-lite/editor-core';
import type { ToneBrushMode } from '@photoshop-lite/editor-core';
import { useEditorStore } from '../../store/editorStore';
import { ImageLayerItem } from './ImageLayerItem';
import { TextLayerItem } from './TextLayerItem';
import { ShapeLayerItem } from './ShapeLayerItem';
import { DrawingLayerItem } from './DrawingLayerItem';
import { PathLayerItem } from './PathLayerItem';
import { GradientLayerItem } from './GradientLayerItem';
import { AdjustmentLayerItem } from './AdjustmentLayerItem';
import { applyAdjustmentLayers } from './adjustmentComposite';
import { CanvasRulers } from './CanvasRulers';
import { Check, X } from 'lucide-react';
import {
  applySpotHealingToImage,
  applyCloneStampToImage,
  sampleCanvasColor,
  floodFillImage,
  applyBlurSpotToImage,
} from '../../utils/retouchHelpers';
import { paintStrokeOnMask, eraseStrokeOnImage, magicWandBounds } from '../../utils/maskHelpers';
import type { PathAnchor, ShapeType } from '../../types/editor';
import { anchorsToSvgPath, dist } from '../../utils/pathHelpers';
import { applyLiquifyPush } from '../../utils/liquifyHelpers';

/** Snap distance to guides, in screen pixels */
const GUIDE_SNAP_PX = 6;
/** Magnetic lasso drops an anchor roughly every N document pixels while dragging */
const MAGNETIC_STEP = 8;

type Point = { x: number; y: number };

/** Document coordinates → image-layer-local pixels (honours position, rotation and scale). */
function toImageLocal(
  layer: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  x: number,
  y: number
): Point {
  const rad = (-layer.rotation * Math.PI) / 180;
  const dx = x - layer.x;
  const dy = y - layer.y;
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;
  return {
    x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / sx,
    y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / sy,
  };
}

/** Document-space vector → image-local vector (no translation). */
function toImageLocalVector(
  layer: { rotation: number; scaleX: number; scaleY: number },
  dx: number,
  dy: number
): Point {
  return toImageLocal({ x: 0, y: 0, ...layer }, dx, dy);
}

const averageScale = (layer: { scaleX: number; scaleY: number }) =>
  Math.max(0.01, (Math.abs(layer.scaleX || 1) + Math.abs(layer.scaleY || 1)) / 2);

function pathBounds(points: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Selection → closed polygon in document coordinates (flat [x,y,...]). */
function selectionToPolygon(sel: {
  x: number;
  y: number;
  width: number;
  height: number;
  mode?: 'rect' | 'ellipse';
  path?: number[];
}): number[] {
  if (sel.path && sel.path.length >= 6) return sel.path;
  if (sel.mode === 'ellipse') {
    const pts: number[] = [];
    const cx = sel.x + sel.width / 2;
    const cy = sel.y + sel.height / 2;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(cx + (Math.cos(a) * sel.width) / 2, cy + (Math.sin(a) * sel.height) / 2);
    }
    return pts;
  }
  return [
    sel.x, sel.y,
    sel.x + sel.width, sel.y,
    sel.x + sel.width, sel.y + sel.height,
    sel.x, sel.y + sel.height,
  ];
}

interface CanvasStageProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({ containerRef }) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const setStageRef = useCallback((node: Konva.Stage | null) => {
    stageRef.current = node;
    registerStage(node);
  }, []);

  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    zoom,
    pan,
    showGrid,
    showRulers,
    activeTool,
    activeShapeType,
    brushSettings,
    penSettings,
    cropSettings,
    layers,
    selectedLayerId,
    setZoom,
    setPan,
    selectLayer,
    updateLayer,
    addDrawingStroke,
    addShapeLayer,
    addPathLayer,
    addTextLayer,
    setCropSettings,
    applyCrop,
    cancelCrop,
    updateBrushSettings,
    artboards,
    activeArtboardId,
    marqueeSelection,
    setMarqueeSelection,
    marqueeMode,
    wandTolerance,
    paintLayerMask,
    toggleLayerMask,
    commitHistory,
    gradientSettings,
    toneBrushSettings,
    guides,
    snapToGuides,
    transformMode,
    placeGradientFill,
    addGradientLayerFromDrag,
  } = useEditorStore();

  // Image layers with any adjustment layers above them folded into their filter settings
  const renderLayers = useMemo(() => applyAdjustmentLayers(layers), [layers]);

  const [containerSize, setContainerSize] = useState({ width: 1000, height: 700 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [keepRatio, setKeepRatio] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<{
    points: number[];
    color: string;
    size: number;
    opacity: number;
    isEraser: boolean;
    hardness?: number;
  } | null>(null);
  const [previewStroke, setPreviewStroke] = useState<number[] | null>(null);

  // Shape creation preview
  const [isCreatingShape, setIsCreatingShape] = useState(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [shapePreviewBox, setShapePreviewBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    x2?: number;
    y2?: number;
  } | null>(null);

  // Marquee selection drag
  const [isCreatingMarquee, setIsCreatingMarquee] = useState(false);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueePreview, setMarqueePreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Lasso freehand path
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoPreview, setLassoPreview] = useState<number[] | null>(null);

  // Spacebar pan detection
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Clone Stamp state
  const [cloneSource, setCloneSource] = useState<{ x: number; y: number } | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const cloneOffsetRef = useRef<{ x: number; y: number } | null>(null);

  // Spot Healing state
  const [isHealing, setIsHealing] = useState(false);

  // Blur tool state
  const [isBlurring, setIsBlurring] = useState(false);

  // Gradient drag (document space)
  const gradientDragRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [gradientDrag, setGradientDrag] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Dodge / Burn / Sharpen + Liquify: serialized, latest-point-wins stroke runner
  const toneStrokeRef = useRef<{ layerId: string; last: Point; latest: Point } | null>(null);
  const liquifyStrokeRef = useRef<{ layerId: string; last: Point; latest: Point } | null>(null);
  const strokeRunnerRef = useRef<{ busy: boolean; pending: (() => Promise<void>) | null }>({
    busy: false,
    pending: null,
  });

  // Healing brush: points accumulate, applied once on mouseup
  const healStrokeRef = useRef<{
    layerId: string;
    points: number[];
    source: Point;
  } | null>(null);
  const [healPreview, setHealPreview] = useState<number[] | null>(null);

  // Polygonal / magnetic lasso (document space, flat [x,y,...])
  const [polyPoints, setPolyPoints] = useState<number[]>([]);
  const magneticDraggingRef = useRef(false);

  // Quick select: brushed bounding box
  const quickSelectRef = useRef<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  // Patch tool: freehand source outline
  const patchDrawRef = useRef(false);
  const [patchPreview, setPatchPreview] = useState<number[] | null>(null);

  // Pen tool draft (document-space anchors)
  const [penAnchors, setPenAnchors] = useState<PathAnchor[]>([]);
  const penDraggingRef = useRef(false);
  const [penCursor, setPenCursor] = useState<{ x: number; y: number } | null>(null);

  // Eyedropper cursor color preview
  const [eyedropperPreview, setEyedropperPreview] = useState<string | null>(null);

  const commitPenPath = useEffectEvent((closed: boolean) => {
    if (penAnchors.length < 2) {
      setPenAnchors([]);
      penDraggingRef.current = false;
      return;
    }
    addPathLayer(penAnchors, closed);
    setPenAnchors([]);
    penDraggingRef.current = false;
    setPenCursor(null);
  });

  /** Close the polygonal / magnetic lasso draft into a path selection */
  const commitPolygon = () => {
    magneticDraggingRef.current = false;
    if (polyPoints.length < 6) {
      setPolyPoints([]);
      return;
    }
    setMarqueeSelection({
      ...pathBounds(polyPoints),
      mode: 'rect',
      path: [...polyPoints, polyPoints[0], polyPoints[1]],
    });
    setPolyPoints([]);
  };
  // Keyboard listener lives in a long-lived effect; keep it pointed at the latest closure
  const commitPolygonRef = useRef(commitPolygon);
  useEffect(() => {
    commitPolygonRef.current = commitPolygon;
  });

  // Resize observer for container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  // Clear in-progress pen when leaving the tool
  useEffect(() => {
    if (activeTool !== 'pen') {
      setPenAnchors([]);
      penDraggingRef.current = false;
      setPenCursor(null);
    }
  }, [activeTool]);

  // Drop in-progress polygon / strokes when switching tools
  useEffect(() => {
    if (activeTool !== 'polyLasso' && activeTool !== 'magneticLasso') {
      setPolyPoints([]);
      magneticDraggingRef.current = false;
    }
    if (activeTool !== 'patch') {
      patchDrawRef.current = false;
      setPatchPreview(null);
    }
    if (activeTool !== 'gradient') {
      gradientDragRef.current = null;
      setGradientDrag(null);
    }
  }, [activeTool]);

  // Space / Shift / Pen Enter·Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setKeepRatio(true);
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setIsSpacePressed(true);
      }
      if (activeTool === 'pen') {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitPenPath(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPenAnchors([]);
          penDraggingRef.current = false;
          setPenCursor(null);
        }
      }
      if (activeTool === 'polyLasso' || activeTool === 'magneticLasso') {
        const tag = (document.activeElement?.tagName ?? '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitPolygonRef.current();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            magneticDraggingRef.current = false;
            setPolyPoints([]);
          }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setKeepRatio(false);
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, commitPenPath]);

  // Update Transformer selection (Effect Event keeps latest ids without rebinding)
  const syncTransformer = useEffectEvent(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if ((activeTool !== 'select' && activeTool !== 'transform') || !selectedLayerId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedNode = stage.findOne(`#${selectedLayerId}`);
    if (selectedNode) {
      transformer.nodes([selectedNode]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
    }
  });

  useEffect(() => {
    syncTransformer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is non-reactive
  }, [selectedLayerId, activeTool, layers]);

  // Mouse wheel zoom/pan — throttled with TanStack Pacer (~60fps)
  const applyWheel = useThrottledCallback(
    (payload: { deltaX: number; deltaY: number; zoomMode: boolean }) => {
      const stage = stageRef.current;
      if (!stage) return;
      const { zoom: currentZoom, pan: currentPan } = useEditorStore.getState();

      if (payload.zoomMode) {
        const scaleBy = 1.08;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = {
          x: (pointer.x - currentPan.x) / currentZoom,
          y: (pointer.y - currentPan.y) / currentZoom,
        };
        const newScale =
          payload.deltaY < 0 ? currentZoom * scaleBy : currentZoom / scaleBy;
        const clampedScale = Math.max(0.1, Math.min(8, newScale));
        setZoom(clampedScale);
        setPan({
          x: pointer.x - mousePointTo.x * clampedScale,
          y: pointer.y - mousePointTo.y * clampedScale,
        });
      } else {
        setPan({
          x: Math.round(currentPan.x - payload.deltaX),
          y: Math.round(currentPan.y - payload.deltaY),
        });
      }
    },
    { wait: 16, leading: true, trailing: true }
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      applyWheel({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        zoomMode: e.ctrlKey || e.metaKey || e.altKey,
      });
    },
    [applyWheel]
  );

  // Get pointer coordinate in canvas coordinate space
  const getCanvasCoords = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return { x: 0, y: 0 };
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };

    return {
      x: Math.round((pointer.x - pan.x) / zoom),
      y: Math.round((pointer.y - pan.y) / zoom),
    };
  };

  // Helper: get the selected image layer
  const getSelectedImageLayer = () => {
    const state = useEditorStore.getState();
    const layer = state.layers.find((l) => l.id === state.selectedLayerId);
    return layer?.type === 'image' ? layer : null;
  };

  const applyBlurThrottled = useAsyncThrottledCallback(
    async (coords: { x: number; y: number }) => {
      const imageLayer = getSelectedImageLayer();
      if (!imageLayer) return;
      const { brushSettings: brush } = useEditorStore.getState();
      const newSrc = await applyBlurSpotToImage(
        imageLayer.src,
        imageLayer.x,
        imageLayer.y,
        coords.x,
        coords.y,
        brush.size / 2,
        brush.opacity
      );
      updateLayer(imageLayer.id, { src: newSrc });
    },
    { wait: 50, leading: true, trailing: true }
  );

  const applyHealThrottled = useAsyncThrottledCallback(
    async (coords: { x: number; y: number }) => {
      const imageLayer = getSelectedImageLayer();
      if (!imageLayer) return;
      const { brushSettings: brush } = useEditorStore.getState();
      const fresh = useEditorStore.getState().layers.find((l) => l.id === imageLayer.id);
      if (!fresh || fresh.type !== 'image') return;
      const newSrc = await applySpotHealingToImage(
        fresh.src,
        fresh.x,
        fresh.y,
        coords.x,
        coords.y,
        brush.size / 2
      );
      updateLayer(fresh.id, { src: newSrc });
    },
    { wait: 60, leading: true, trailing: true }
  );

  const applyCloneThrottled = useAsyncThrottledCallback(
    async (coords: { x: number; y: number }) => {
      const imageLayer = getSelectedImageLayer();
      const offset = cloneOffsetRef.current;
      if (!imageLayer || !offset) return;
      const { brushSettings: brush } = useEditorStore.getState();
      const fresh = useEditorStore.getState().layers.find((l) => l.id === imageLayer.id);
      if (!fresh || fresh.type !== 'image') return;
      const srcX = coords.x - offset.x;
      const srcY = coords.y - offset.y;
      const newSrc = await applyCloneStampToImage(
        fresh.src,
        fresh.x,
        fresh.y,
        srcX,
        srcY,
        coords.x,
        coords.y,
        brush.size / 2,
        brush.opacity
      );
      updateLayer(fresh.id, { src: newSrc });
      setCloneSource({ x: srcX, y: srcY });
    },
    { wait: 50, leading: true, trailing: true }
  );

  /**
   * Serialized "latest wins" runner for async per-pixel strokes: only one image round-trip is
   * in flight at a time, and while it runs only the newest queued task is kept.
   */
  const runLatest = (task: () => Promise<void>) => {
    const runner = strokeRunnerRef.current;
    if (runner.busy) {
      runner.pending = task;
      return;
    }
    runner.busy = true;
    void (async () => {
      let next: (() => Promise<void>) | null = task;
      while (next) {
        runner.pending = null;
        try {
          await next();
        } catch (err) {
          console.error('Canvas stroke failed:', err);
        }
        next = runner.pending;
      }
      runner.busy = false;
    })();
  };

  const TONE_MODE: Record<string, ToneBrushMode> = {
    dodge: 'dodge',
    burn: 'burn',
    sharpenTool: 'sharpen',
  };

  const queueToneStamp = (
    stroke: { layerId: string; last: Point; latest: Point },
    mode: ToneBrushMode
  ) => {
    runLatest(async () => {
      const state = useEditorStore.getState();
      const layer = state.layers.find((l) => l.id === stroke.layerId);
      if (!layer || layer.type !== 'image') return;

      const from = stroke.last;
      const to = stroke.latest;
      stroke.last = to;

      const radius = Math.max(2, state.toneBrushSettings.size / 2 / averageScale(layer));
      const stamps: Point[] = [];
      // Fill the gap when the pointer outran the throttle
      if (dist(from.x, from.y, to.x, to.y) > radius * 0.8) {
        stamps.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
      }
      stamps.push(to);

      let nextSrc = layer.src;
      for (const p of stamps) {
        const local = toImageLocal(layer, p.x, p.y);
        nextSrc = await applyToneBrushToImage(nextSrc, {
          cx: local.x,
          cy: local.y,
          radius,
          hardness: state.toneBrushSettings.hardness,
          opacity: state.brushSettings.opacity,
          exposure: state.toneBrushSettings.exposure,
          mode,
        });
      }
      updateLayer(layer.id, { src: nextSrc });
    });
  };

  const queueLiquifyPush = (stroke: { layerId: string; last: Point; latest: Point }) => {
    runLatest(async () => {
      const state = useEditorStore.getState();
      const layer = state.layers.find((l) => l.id === stroke.layerId);
      if (!layer || layer.type !== 'image') return;

      const from = stroke.last;
      const to = stroke.latest;
      if (dist(from.x, from.y, to.x, to.y) < 1) return;
      stroke.last = to;

      const localFrom = toImageLocal(layer, from.x, from.y);
      const localDelta = toImageLocalVector(layer, to.x - from.x, to.y - from.y);
      const nextSrc = await applyLiquifyPush(layer.src, {
        cx: localFrom.x + localDelta.x / 2,
        cy: localFrom.y + localDelta.y / 2,
        radius: state.brushSettings.size / 2 / averageScale(layer),
        dx: localDelta.x,
        dy: localDelta.y,
        strength: Math.max(0.25, state.brushSettings.opacity),
      });
      updateLayer(layer.id, { src: nextSrc });
    });
  };

  const applyHealingStroke = async (stroke: { layerId: string; points: number[]; source: Point }) => {
    const state = useEditorStore.getState();
    const layer = state.layers.find((l) => l.id === stroke.layerId);
    if (!layer || layer.type !== 'image' || stroke.points.length < 2) return;

    const points: number[] = [];
    for (let i = 0; i < stroke.points.length; i += 2) {
      const p = toImageLocal(layer, stroke.points[i], stroke.points[i + 1]);
      points.push(p.x, p.y);
    }
    const srcLocal = toImageLocal(layer, stroke.source.x, stroke.source.y);

    commitHistory('Healing Brush');
    const newSrc = await applyHealingBrushToImage(layer.src, {
      points,
      size: state.brushSettings.size / averageScale(layer),
      hardness: state.brushSettings.hardness,
      sourceOffsetX: srcLocal.x - points[0],
      sourceOffsetY: srcLocal.y - points[1],
    });
    updateLayer(layer.id, { src: newSrc });
  };

  /** Patch: copy the selected region (source) so it is centred on the clicked destination. */
  const applyPatchAt = async (dest: Point) => {
    const state = useEditorStore.getState();
    const layer = state.layers.find((l) => l.id === state.selectedLayerId);
    const selection = state.marqueeSelection;
    if (!layer || layer.type !== 'image' || !selection) return;

    const polygon = selectionToPolygon(selection);
    const fromPath: number[] = [];
    for (let i = 0; i < polygon.length; i += 2) {
      const p = toImageLocal(layer, polygon[i], polygon[i + 1]);
      fromPath.push(p.x, p.y);
    }
    const to = toImageLocal(layer, dest.x, dest.y);

    commitHistory('Patch');
    const newSrc = await applyPatchToImage(layer.src, {
      fromPath,
      toX: to.x,
      toY: to.y,
      feather: 2,
    });
    updateLayer(layer.id, { src: newSrc });
  };

  // Snap dragged layers to guides (Stage receives bubbling dragmove events)
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!snapToGuides || guides.length === 0) return;
    const node = e.target;
    const contentLayer = node.getLayer();
    if (!contentLayer || contentLayer.id() !== 'export-content' || !node.id()) return;

    const rect = node.getClientRect({ relativeTo: contentLayer });
    const threshold = GUIDE_SNAP_PX / zoom;
    let snapX: number | null = null;
    let snapY: number | null = null;

    const xEdges = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
    const yEdges = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

    for (const g of guides) {
      const edges = g.orientation === 'vertical' ? xEdges : yEdges;
      for (const edge of edges) {
        const delta = g.position - edge;
        if (Math.abs(delta) > threshold) continue;
        if (g.orientation === 'vertical') {
          if (snapX === null || Math.abs(delta) < Math.abs(snapX)) snapX = delta;
        } else if (snapY === null || Math.abs(delta) < Math.abs(snapY)) {
          snapY = delta;
        }
      }
    }

    if (snapX !== null) node.x(node.x() + snapX);
    if (snapY !== null) node.y(node.y() + snapY);
  };

  // Perform eyedropper sampling using an off-screen canvas render
  const performEyedropperSample = useCallback(
    async (canvasX: number, canvasY: number) => {
      const offscreen = document.createElement('canvas');
      offscreen.width = canvasWidth;
      offscreen.height = canvasHeight;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      // Draw all visible layers
      for (const layer of layers) {
        if (!layer.visible) continue;
        if (layer.type === 'image') {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              ctx.save();
              ctx.globalAlpha = layer.opacity;
              ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
              ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
              ctx.rotate((layer.rotation * Math.PI) / 180);
              ctx.scale(layer.scaleX, layer.scaleY);
              ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
              ctx.restore();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = layer.src;
          });
        }
      }

      const sampledColor = sampleCanvasColor(offscreen, canvasX, canvasY);
      updateBrushSettings({ color: sampledColor });
      setEyedropperPreview(null);
      return sampledColor;
    },
    [layers, canvasWidth, canvasHeight, updateBrushSettings]
  );

  const handleMouseDown = async (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If Space is pressed or Hand tool active: start pan
    if (isSpacePressed || activeTool === 'hand' || e.evt.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.evt.clientX - pan.x, y: e.evt.clientY - pan.y };
      return;
    }

    // Zoom tool: click zoom in, Alt+click zoom out
    if (activeTool === 'zoom') {
      const factor = e.evt.altKey ? 1 / 1.25 : 1.25;
      setZoom((z) => Math.min(8, Math.max(0.1, z * factor)));
      return;
    }

    const coords = getCanvasCoords(e);

    // Eyedropper: sample color on click
    if (activeTool === 'eyedropper') {
      await performEyedropperSample(coords.x, coords.y);
      return;
    }

    // Paint bucket flood fill
    if (activeTool === 'fill') {
      const imageLayer = getSelectedImageLayer();
      if (imageLayer) {
        const filled = await floodFillImage({
          src: imageLayer.src,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          clickX: coords.x,
          clickY: coords.y,
          fillColor: brushSettings.color,
          tolerance: wandTolerance,
        });
        if (filled) {
          updateLayer(imageLayer.id, { src: filled });
        }
      }
      return;
    }

    // Gradient — drag from start to end point
    if (activeTool === 'gradient') {
      const drag = { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y };
      gradientDragRef.current = drag;
      setGradientDrag(drag);
      return;
    }

    // Dodge / Burn / Sharpen — paint tone adjustments straight into the image layer
    if (activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sharpenTool') {
      const imageLayer = getSelectedImageLayer();
      if (!imageLayer) return;
      commitHistory(
        activeTool === 'dodge' ? 'Dodge' : activeTool === 'burn' ? 'Burn' : 'Sharpen Brush'
      );
      const stroke = { layerId: imageLayer.id, last: coords, latest: coords };
      toneStrokeRef.current = stroke;
      queueToneStamp(stroke, TONE_MODE[activeTool]);
      return;
    }

    // Liquify — forward-warp pixels along the drag
    if (activeTool === 'liquify') {
      const imageLayer = getSelectedImageLayer();
      if (!imageLayer) return;
      commitHistory('Liquify');
      liquifyStrokeRef.current = { layerId: imageLayer.id, last: coords, latest: coords };
      return;
    }

    // Healing brush — Alt+click sets the source, drag paints, applied once on mouseup
    if (activeTool === 'healing') {
      if (e.evt.altKey) {
        updateBrushSettings({ cloneSource: { x: coords.x, y: coords.y } });
        return;
      }
      const imageLayer = getSelectedImageLayer();
      const source = brushSettings.cloneSource;
      if (!imageLayer || !source) return;
      healStrokeRef.current = {
        layerId: imageLayer.id,
        points: [coords.x, coords.y],
        source: { x: source.x, y: source.y },
      };
      setHealPreview([coords.x, coords.y]);
      return;
    }

    // Patch — drag outlines the source region, click then drops it at the destination
    if (activeTool === 'patch') {
      if (!getSelectedImageLayer()) return;
      patchDrawRef.current = true;
      setPatchPreview([coords.x, coords.y]);
      return;
    }

    // Polygonal / Magnetic lasso — click adds vertices; double-click, Enter or first-point click closes
    if (activeTool === 'polyLasso' || activeTool === 'magneticLasso') {
      if (e.evt.detail >= 2) {
        if (polyPoints.length >= 6) commitPolygon();
        return;
      }
      if (
        polyPoints.length >= 6 &&
        dist(coords.x, coords.y, polyPoints[0], polyPoints[1]) <= 8 / zoom
      ) {
        commitPolygon();
        return;
      }
      if (polyPoints.length === 0) setMarqueeSelection(null);
      const lastX = polyPoints[polyPoints.length - 2];
      const lastY = polyPoints[polyPoints.length - 1];
      if (polyPoints.length === 0 || lastX !== coords.x || lastY !== coords.y) {
        setPolyPoints((prev) => [...prev, coords.x, coords.y]);
      }
      magneticDraggingRef.current = activeTool === 'magneticLasso';
      return;
    }

    // Quick select — painted area grows a rectangular selection (Shift adds to it)
    if (activeTool === 'quickSelect') {
      const r = brushSettings.size / 2;
      const base =
        e.evt.shiftKey && marqueeSelection && !marqueeSelection.path ? marqueeSelection : null;
      quickSelectRef.current = base
        ? {
            minX: Math.min(base.x, coords.x - r),
            minY: Math.min(base.y, coords.y - r),
            maxX: Math.max(base.x + base.width, coords.x + r),
            maxY: Math.max(base.y + base.height, coords.y + r),
          }
        : { minX: coords.x - r, minY: coords.y - r, maxX: coords.x + r, maxY: coords.y + r };
      const b = quickSelectRef.current;
      setMarqueeSelection({
        x: Math.max(0, b.minX),
        y: Math.max(0, b.minY),
        width: Math.max(1, Math.min(canvasWidth, b.maxX) - Math.max(0, b.minX)),
        height: Math.max(1, Math.min(canvasHeight, b.maxY) - Math.max(0, b.minY)),
        mode: 'rect',
      });
      return;
    }

    // Blur tool
    if (activeTool === 'blur') {
      setIsBlurring(true);
      void applyBlurThrottled(coords);
      return;
    }

    // Spot Healing Brush — click/drag
    if (activeTool === 'spotHealing') {
      if (!getSelectedImageLayer()) return;
      setIsHealing(true);
      void applyHealThrottled(coords);
      return;
    }

    // Clone Stamp — Alt+click source, then drag to paint
    if (activeTool === 'clone') {
      if (e.evt.altKey) {
        setCloneSource({ x: coords.x, y: coords.y });
        updateBrushSettings({ cloneSource: { x: coords.x, y: coords.y } });
        return;
      }
      if (cloneSource && getSelectedImageLayer()) {
        cloneOffsetRef.current = {
          x: coords.x - cloneSource.x,
          y: coords.y - cloneSource.y,
        };
        setIsCloning(true);
        void applyCloneThrottled(coords);
      }
      return;
    }

    // Type tool — click to place text
    if (activeTool === 'text') {
      addTextLayer({ x: coords.x, y: coords.y });
      return;
    }

    // Brush or Eraser or RefineBrush tool
    if (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'refineBrush') {
      setIsDrawing(true);
      const isEraser = activeTool === 'eraser' || (activeTool === 'refineBrush' && brushSettings.refineMode === 'erase');
      currentStrokeRef.current = {
        points: [coords.x, coords.y],
        color: isEraser ? 'rgba(0,0,0,1)' : brushSettings.color,
        size: brushSettings.size,
        opacity: brushSettings.opacity,
        isEraser,
        hardness: brushSettings.hardness,
      };
      setPreviewStroke([coords.x, coords.y]);
      return;
    }

    // Shape creation tool
    if (activeTool === 'shape') {
      setIsCreatingShape(true);
      shapeStartRef.current = { x: coords.x, y: coords.y };
      setShapePreviewBox({ x: coords.x, y: coords.y, width: 0, height: 0, x2: coords.x, y2: coords.y });
      return;
    }

    // Pen tool — click to place anchors, drag for smooth handles, click first to close
    if (activeTool === 'pen') {
      if (
        penAnchors.length >= 2 &&
        dist(coords.x, coords.y, penAnchors[0].x, penAnchors[0].y) <= penSettings.closeThreshold
      ) {
        commitPenPath(true);
        return;
      }

      const next: PathAnchor = { x: coords.x, y: coords.y };
      setPenAnchors((prev) => [...prev, next]);
      penDraggingRef.current = true;
      return;
    }

    // Marquee rectangular / elliptical selection
    if (activeTool === 'marquee') {
      setIsCreatingMarquee(true);
      marqueeStartRef.current = { x: coords.x, y: coords.y };
      setMarqueePreview({ x: coords.x, y: coords.y, width: 0, height: 0 });
      setMarqueeSelection(null);
      return;
    }

    // Lasso freehand
    if (activeTool === 'lasso') {
      setIsDrawingLasso(true);
      setLassoPreview([coords.x, coords.y]);
      setMarqueeSelection(null);
      return;
    }

    // Magic wand — select similar color region
    if (activeTool === 'wand') {
      const imageLayer = getSelectedImageLayer();
      if (imageLayer) {
        const bounds = await magicWandBounds({
          src: imageLayer.src,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          layerWidth: imageLayer.width,
          layerHeight: imageLayer.height,
          clickX: coords.x,
          clickY: coords.y,
          tolerance: wandTolerance,
        });
        if (bounds) {
          setMarqueeSelection({ ...bounds, mode: 'rect' });
        } else {
          setMarqueeSelection(null);
        }
      }
      return;
    }

    // Deselect if clicking on empty canvas background
    if (e.target === e.target.getStage() || e.target.name() === 'canvas-bg') {
      selectLayer(null);
      setMarqueeSelection(null);
      setLassoPreview(null);
    }
  };

  const handleMouseMove = async (e: Konva.KonvaEventObject<MouseEvent>) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);

    if (activeTool === 'blur' && isBlurring) {
      void applyBlurThrottled(coords);
    }

    if (gradientDragRef.current) {
      let { x: x2, y: y2 } = coords;
      const { x1, y1 } = gradientDragRef.current;
      if (e.evt.shiftKey) {
        // Constrain to 45° steps
        const len = dist(x1, y1, x2, y2);
        const angle = Math.round(Math.atan2(y2 - y1, x2 - x1) / (Math.PI / 4)) * (Math.PI / 4);
        x2 = Math.round(x1 + Math.cos(angle) * len);
        y2 = Math.round(y1 + Math.sin(angle) * len);
      }
      gradientDragRef.current = { x1, y1, x2, y2 };
      setGradientDrag(gradientDragRef.current);
    }

    if (toneStrokeRef.current) {
      toneStrokeRef.current.latest = coords;
      const mode = TONE_MODE[activeTool];
      if (mode) queueToneStamp(toneStrokeRef.current, mode);
    }

    if (liquifyStrokeRef.current) {
      liquifyStrokeRef.current.latest = coords;
      queueLiquifyPush(liquifyStrokeRef.current);
    }

    if (healStrokeRef.current) {
      const pts = healStrokeRef.current.points;
      if (dist(coords.x, coords.y, pts[pts.length - 2], pts[pts.length - 1]) >= 2) {
        pts.push(coords.x, coords.y);
        setHealPreview([...pts]);
      }
    }

    if (patchDrawRef.current) {
      setPatchPreview((prev) => {
        if (!prev) return prev;
        const dx = coords.x - prev[prev.length - 2];
        const dy = coords.y - prev[prev.length - 1];
        return dx * dx + dy * dy > 4 ? [...prev, coords.x, coords.y] : prev;
      });
    }

    if (magneticDraggingRef.current && activeTool === 'magneticLasso') {
      setPolyPoints((prev) => {
        if (prev.length < 2) return prev;
        return dist(coords.x, coords.y, prev[prev.length - 2], prev[prev.length - 1]) >=
          MAGNETIC_STEP
          ? [...prev, coords.x, coords.y]
          : prev;
      });
    }

    if (quickSelectRef.current) {
      const r = brushSettings.size / 2;
      const b = quickSelectRef.current;
      b.minX = Math.min(b.minX, coords.x - r);
      b.minY = Math.min(b.minY, coords.y - r);
      b.maxX = Math.max(b.maxX, coords.x + r);
      b.maxY = Math.max(b.maxY, coords.y + r);
      const x = Math.max(0, b.minX);
      const y = Math.max(0, b.minY);
      setMarqueeSelection({
        x,
        y,
        width: Math.max(1, Math.min(canvasWidth, b.maxX) - x),
        height: Math.max(1, Math.min(canvasHeight, b.maxY) - y),
        mode: 'rect',
      });
    }

    if (activeTool === 'spotHealing' && isHealing) {
      void applyHealThrottled(coords);
    }

    if (activeTool === 'clone' && isCloning) {
      void applyCloneThrottled(coords);
    }

    // Eyedropper: show color preview while hovering
    if (activeTool === 'eyedropper') {
      // Light sampling for preview using raw stage pixel (simplified)
      const stage = stageRef.current;
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          // Just show position, actual sampling happens on click
          setEyedropperPreview(`${coords.x}, ${coords.y}`);
        }
      }
      return;
    }

    // Pan handling
    if (isPanning && panStartRef.current) {
      setPan({
        x: e.evt.clientX - panStartRef.current.x,
        y: e.evt.clientY - panStartRef.current.y,
      });
      return;
    }

    // Drawing brush handling
    if (isDrawing && currentStrokeRef.current) {
      const newPoints = [...currentStrokeRef.current.points, coords.x, coords.y];
      currentStrokeRef.current.points = newPoints;
      setPreviewStroke(newPoints);
      return;
    }

    // Shape creation preview
    if (isCreatingShape && shapeStartRef.current) {
      const startX = shapeStartRef.current.x;
      const startY = shapeStartRef.current.y;
      const curX = coords.x;
      const curY = coords.y;

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);

      setShapePreviewBox({ x, y, width, height, x2: curX, y2: curY });
    }

    // Marquee preview
    if (isCreatingMarquee && marqueeStartRef.current) {
      const startX = marqueeStartRef.current.x;
      const startY = marqueeStartRef.current.y;
      const x = Math.min(startX, coords.x);
      const y = Math.min(startY, coords.y);
      const width = Math.abs(coords.x - startX);
      const height = Math.abs(coords.y - startY);
      setMarqueePreview({ x, y, width, height });
    }

    // Lasso preview
    if (isDrawingLasso && lassoPreview) {
      const lastX = lassoPreview[lassoPreview.length - 2];
      const lastY = lassoPreview[lassoPreview.length - 1];
      const dx = coords.x - lastX;
      const dy = coords.y - lastY;
      if (dx * dx + dy * dy > 4) {
        setLassoPreview([...lassoPreview, coords.x, coords.y]);
      }
    }

    // Pen rubber-band + handle drag
    if (activeTool === 'pen') {
      setPenCursor(coords);
      if (penDraggingRef.current && penAnchors.length > 0) {
        const idx = penAnchors.length - 1;
        const anchor = penAnchors[idx];
        const outX = coords.x - anchor.x;
        const outY = coords.y - anchor.y;
        setPenAnchors((prev) =>
          prev.map((a, i) =>
            i === idx
              ? {
                  ...a,
                  handleOutX: outX,
                  handleOutY: outY,
                  handleInX: -outX,
                  handleInY: -outY,
                }
              : a
          )
        );
      }
    }
  };

  const handleMouseUp = async (e?: Konva.KonvaEventObject<MouseEvent>) => {
    if (gradientDragRef.current) {
      const { x1, y1, x2, y2 } = gradientDragRef.current;
      gradientDragRef.current = null;
      setGradientDrag(null);
      if (dist(x1, y1, x2, y2) >= 2) {
        // Default: editable gradient layer. Alt-release bakes a raster fill layer instead.
        if (e?.evt.altKey) placeGradientFill(x1, y1, x2, y2);
        else addGradientLayerFromDrag(x1, y1, x2, y2);
      }
    }
    toneStrokeRef.current = null;
    liquifyStrokeRef.current = null;
    magneticDraggingRef.current = false;
    quickSelectRef.current = null;

    if (healStrokeRef.current) {
      const stroke = healStrokeRef.current;
      healStrokeRef.current = null;
      setHealPreview(null);
      void applyHealingStroke(stroke);
    }

    if (patchDrawRef.current) {
      patchDrawRef.current = false;
      const outline = patchPreview;
      setPatchPreview(null);
      if (outline && outline.length >= 6) {
        setMarqueeSelection({
          ...pathBounds(outline),
          mode: 'rect',
          path: [...outline, outline[0], outline[1]],
        });
      } else if (outline && useEditorStore.getState().marqueeSelection) {
        await applyPatchAt({ x: outline[0], y: outline[1] });
      }
    }

    if (isBlurring) {
      setIsBlurring(false);
    }
    if (isHealing) {
      setIsHealing(false);
    }
    if (isCloning) {
      setIsCloning(false);
      cloneOffsetRef.current = null;
    }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }

    if (isDrawing && currentStrokeRef.current) {
      setIsDrawing(false);
      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      setPreviewStroke(null);

      const imageLayer = getSelectedImageLayer();

      // Refine brush → paint (or auto-create) layer mask
      if (activeTool === 'refineBrush' && imageLayer) {
        if (!imageLayer.hasLayerMask || !imageLayer.layerMaskSrc) {
          toggleLayerMask(imageLayer.id);
        }
        const masked = useEditorStore.getState().layers.find((l) => l.id === imageLayer.id);
        const maskSrc =
          masked?.type === 'image' && masked.hasLayerMask ? masked.layerMaskSrc : undefined;
        if (maskSrc) {
          commitHistory('Paint Layer Mask');
          const newMask = await paintStrokeOnMask({
            maskSrc,
            layerX: imageLayer.x,
            layerY: imageLayer.y,
            layerWidth: imageLayer.width,
            layerHeight: imageLayer.height,
            points: stroke.points,
            size: stroke.size,
            erase: stroke.isEraser,
          });
          paintLayerMask(imageLayer.id, newMask);
          return;
        }
      }

      // Eraser on selected image → punch transparent pixels
      if (activeTool === 'eraser' && imageLayer) {
        commitHistory('Erase');
        const newSrc = await eraseStrokeOnImage({
          src: imageLayer.src,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          layerWidth: imageLayer.width,
          layerHeight: imageLayer.height,
          points: stroke.points,
          size: stroke.size,
          hardness: stroke.hardness,
        });
        updateLayer(imageLayer.id, { src: newSrc });
        return;
      }

      const drawingLayer = layers.find((l) => l.type === 'drawing');
      addDrawingStroke(drawingLayer?.id || 'new', stroke);
    }

    if (isCreatingShape && shapePreviewBox && shapeStartRef.current) {
      setIsCreatingShape(false);
      const { x, y, width, height, x2, y2 } = shapePreviewBox;
      const start = shapeStartRef.current;
      const isClick = width <= 5 && height <= 5;
      const isLineLike = activeShapeType === 'line' || activeShapeType === 'arrow';

      if (isClick && !isLineLike) {
        // Click to drop a default-sized shape centered on the pointer
        addShapeLayer(activeShapeType);
        setTimeout(() => {
          const currentSelected = useEditorStore.getState().selectedLayerId;
          if (!currentSelected) return;
          const size = 180;
          updateLayer(currentSelected, {
            x: Math.round(start.x - size / 2),
            y: Math.round(start.y - size / 2),
            width: size,
            height: size,
          });
        }, 10);
      } else if (width > 5 || height > 5 || (x2 !== undefined && y2 !== undefined)) {
        addShapeLayer(activeShapeType);
        setTimeout(() => {
          const currentSelected = useEditorStore.getState().selectedLayerId;
          if (!currentSelected) return;
          if (isLineLike && x2 !== undefined && y2 !== undefined) {
            const minX = Math.min(start.x, x2);
            const minY = Math.min(start.y, y2);
            updateLayer(currentSelected, {
              x: minX,
              y: minY,
              width: Math.max(8, Math.abs(x2 - start.x)),
              height: Math.max(8, Math.abs(y2 - start.y)),
              points: [start.x - minX, start.y - minY, x2 - minX, y2 - minY],
            });
          } else {
            updateLayer(currentSelected, {
              x,
              y,
              width: Math.max(8, width),
              height: Math.max(8, height),
            });
          }
        }, 10);
      }
      shapeStartRef.current = null;
      setShapePreviewBox(null);
    }

    if (isCreatingMarquee && marqueePreview) {
      setIsCreatingMarquee(false);
      if (marqueePreview.width > 2 && marqueePreview.height > 2) {
        setMarqueeSelection({ ...marqueePreview, mode: marqueeMode });
      } else {
        setMarqueeSelection(null);
      }
      marqueeStartRef.current = null;
      setMarqueePreview(null);
    }

    if (isDrawingLasso && lassoPreview) {
      setIsDrawingLasso(false);
      if (lassoPreview.length >= 6) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < lassoPreview.length; i += 2) {
          minX = Math.min(minX, lassoPreview[i]);
          maxX = Math.max(maxX, lassoPreview[i]);
          minY = Math.min(minY, lassoPreview[i + 1]);
          maxY = Math.max(maxY, lassoPreview[i + 1]);
        }
        setMarqueeSelection({
          x: minX,
          y: minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
          mode: 'rect',
          path: [...lassoPreview, lassoPreview[0], lassoPreview[1]],
        });
      }
      setLassoPreview(null);
    }

    if (penDraggingRef.current) {
      penDraggingRef.current = false;
    }
  };

  // Cursor style computation
  const pointerPolicy = listeningPolicy(activeTool);

  // Transform tool: modes that Konva can only approximate (no true skew/distort/perspective/warp)
  const transformToolActive = activeTool === 'transform';
  const freeTransformMode =
    transformToolActive && ['skew', 'distort', 'perspective', 'warp'].includes(transformMode);
  const selectedLayerForTransform = layers.find((l) => l.id === selectedLayerId);
  const isLineLikeShape =
    selectedLayerForTransform?.type === 'shape' &&
    ['line', 'arrow'].includes(selectedLayerForTransform.shapeType);
  const transformerAnchors: string[] | undefined = isLineLikeShape
    ? ['middle-left', 'middle-right', 'top-center', 'bottom-center']
    : transformToolActive && transformMode === 'rotate'
      ? []
      : transformToolActive && transformMode === 'scale'
        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        : undefined;

  const getCursorClass = () => {
    if (isSpacePressed || isPanning || activeTool === 'hand') return 'cursor-grab active:cursor-grabbing';
    if (activeTool === 'clone') return cloneSource ? 'cursor-crosshair' : 'cursor-copy';
    if (activeTool === 'healing') return brushSettings.cloneSource ? 'cursor-crosshair' : 'cursor-copy';
    if (activeTool === 'liquify') return 'cursor-move';
    if (activeTool === 'transform') return 'cursor-default';
    if (
      activeTool === 'gradient' ||
      activeTool === 'dodge' ||
      activeTool === 'burn' ||
      activeTool === 'sharpenTool' ||
      activeTool === 'polyLasso' ||
      activeTool === 'magneticLasso' ||
      activeTool === 'quickSelect' ||
      activeTool === 'patch'
    ) {
      return 'cursor-crosshair';
    }
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'zoom') return 'cursor-zoom-in';
    if (pointerPolicy.cursor === 'crosshair') return 'cursor-crosshair';
    if (pointerPolicy.cursor === 'grab') return 'cursor-grab active:cursor-grabbing';
    return 'cursor-default';
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-[var(--bg-app)] ${getCursorClass()}`}
      onWheel={handleWheel}
      onMouseLeave={() => { setCursorPos(null); setEyedropperPreview(null); }}
    >
      {/* Rulers */}
      {showRulers && (
        <CanvasRulers
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoom={zoom}
          pan={pan}
          cursorPos={cursorPos}
        />
      )}

      {/* Main Konva Stage — content vs UI split so export matches preview */}
      <Stage
        ref={setStageRef}
        width={containerSize.width}
        height={containerSize.height}
        listening={pointerPolicy.stageListening}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragMove={handleDragMove}
      >
        <Layer
          id="export-content"
          x={pan.x}
          y={pan.y}
          scaleX={zoom}
          scaleY={zoom}
          listening={pointerPolicy.contentListening || activeTool === 'select'}
        >
          {/* Canvas Background (swapped during export for transparent/solid) */}
          <Rect
            id="export-bg"
            name="canvas-bg"
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill={backgroundColor === 'transparent' ? '#1f2128' : backgroundColor}
            shadowColor="#000000"
            shadowBlur={25}
            shadowOffset={{ x: 0, y: 10 }}
            shadowOpacity={0.65}
          />

          {/* Document Layers (rendered in array order: bottom to top) */}
          {renderLayers.map((layer) => {
            const isSelected = layer.id === selectedLayerId;

            if (layer.type === 'image') {
              return (
                <ImageLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            if (layer.type === 'text') {
              return (
                <TextLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            if (layer.type === 'shape') {
              return (
                <ShapeLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            if (layer.type === 'drawing') {
              return (
                <DrawingLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            if (layer.type === 'path') {
              return (
                <PathLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            if (layer.type === 'gradient') {
              return (
                <GradientLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(updates) => updateLayer(layer.id, updates)}
                />
              );
            }
            // Adjustment layers are folded into image filters and shown as badges in the UI layer
            return null;
          })}
        </Layer>

        {/* FastLayer: guides / previews — no hit-testing, cheaper redraws */}
        <FastLayer id="export-guides" x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom} listening={false}>
          {/* Artboard frames */}
          {artboards.map((ab) => {
            const active = ab.id === activeArtboardId;
            return (
              <React.Fragment key={ab.id}>
                <Rect
                  x={ab.x}
                  y={ab.y}
                  width={ab.width}
                  height={ab.height}
                  stroke={active ? '#e8a54b' : '#8a8378'}
                  strokeWidth={(active ? 1.75 : 1) / zoom}
                  dash={active ? undefined : [8 / zoom, 5 / zoom]}
                  listening={false}
                />
                <KonvaText
                  x={ab.x}
                  y={ab.y - 16 / zoom}
                  text={ab.name.toUpperCase()}
                  fontSize={10 / zoom}
                  fontFamily="monospace"
                  fill={active ? '#e8a54b' : '#8a8378'}
                  listening={false}
                />
              </React.Fragment>
            );
          })}
          {/* Grid overlay */}
          {showGrid && (
            <>
              {Array.from({ length: Math.ceil(canvasWidth / 50) + 1 }).map((_, i) => (
                <Line
                  key={`gv_${i}`}
                  points={[i * 50, 0, i * 50, canvasHeight]}
                  stroke="#374151"
                  strokeWidth={0.5 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              ))}
              {Array.from({ length: Math.ceil(canvasHeight / 50) + 1 }).map((_, i) => (
                <Line
                  key={`gh_${i}`}
                  points={[0, i * 50, canvasWidth, i * 50]}
                  stroke="#374151"
                  strokeWidth={0.5 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              ))}
            </>
          )}

          {/* Guides */}
          {guides.map((g) =>
            g.orientation === 'vertical' ? (
              <Line
                key={g.id}
                points={[
                  g.position,
                  -pan.y / zoom,
                  g.position,
                  (containerSize.height - pan.y) / zoom,
                ]}
                stroke="#2fd3c4"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                opacity={0.9}
                listening={false}
              />
            ) : (
              <Line
                key={g.id}
                points={[
                  -pan.x / zoom,
                  g.position,
                  (containerSize.width - pan.x) / zoom,
                  g.position,
                ]}
                stroke="#2fd3c4"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                opacity={0.9}
                listening={false}
              />
            )
          )}

          {/* Gradient drag preview */}
          {gradientDrag && (
            <>
              {gradientSettings.gradientType === 'radial' && (
                <Circle
                  x={gradientDrag.x1}
                  y={gradientDrag.y1}
                  radius={dist(gradientDrag.x1, gradientDrag.y1, gradientDrag.x2, gradientDrag.y2)}
                  stroke="rgba(236, 232, 225, 0.6)"
                  strokeWidth={1 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  listening={false}
                />
              )}
              <Line
                points={[gradientDrag.x1, gradientDrag.y1, gradientDrag.x2, gradientDrag.y2]}
                stroke="#1a1208"
                strokeWidth={3.5 / zoom}
                lineCap="round"
                listening={false}
              />
              <Line
                points={[gradientDrag.x1, gradientDrag.y1, gradientDrag.x2, gradientDrag.y2]}
                stroke="#ece8e1"
                strokeWidth={1.5 / zoom}
                lineCap="round"
                listening={false}
              />
              <Circle
                x={gradientDrag.x1}
                y={gradientDrag.y1}
                radius={5 / zoom}
                fill={gradientSettings.colorStops[0]?.color ?? '#000000'}
                stroke="#ece8e1"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
              <Circle
                x={gradientDrag.x2}
                y={gradientDrag.y2}
                radius={5 / zoom}
                fill={gradientSettings.colorStops[gradientSettings.colorStops.length - 1]?.color ?? '#ffffff'}
                stroke="#ece8e1"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
            </>
          )}

          {/* Polygonal / magnetic lasso draft */}
          {(activeTool === 'polyLasso' || activeTool === 'magneticLasso') && polyPoints.length > 0 && (
            <>
              <Line
                points={
                  cursorPos && !magneticDraggingRef.current
                    ? [...polyPoints, cursorPos.x, cursorPos.y]
                    : polyPoints
                }
                stroke="#ece8e1"
                strokeWidth={1.25 / zoom}
                dash={[5 / zoom, 4 / zoom]}
                listening={false}
              />
              {Array.from({ length: polyPoints.length / 2 }).map((_, i) => {
                const px = polyPoints[i * 2];
                const py = polyPoints[i * 2 + 1];
                const isFirst = i === 0;
                const nearFirst =
                  isFirst &&
                  polyPoints.length >= 6 &&
                  !!cursorPos &&
                  dist(cursorPos.x, cursorPos.y, px, py) <= 8 / zoom;
                return (
                  <Circle
                    key={`poly-${i}`}
                    x={px}
                    y={py}
                    radius={(isFirst ? (nearFirst ? 7 : 5) : 3) / zoom}
                    fill={isFirst ? '#d4923a' : '#ece8e1'}
                    stroke={nearFirst ? '#5ecf9a' : '#1a1208'}
                    strokeWidth={(nearFirst ? 2 : 1) / zoom}
                    listening={false}
                  />
                );
              })}
            </>
          )}

          {/* Patch source outline */}
          {patchPreview && patchPreview.length >= 4 && (
            <Line
              points={patchPreview}
              stroke="#5b8def"
              strokeWidth={1.25 / zoom}
              dash={[5 / zoom, 4 / zoom]}
              closed
              fill="rgba(91, 141, 239, 0.12)"
              listening={false}
            />
          )}

          {/* Healing brush stroke + source crosshair */}
          {healPreview && (
            <Line
              points={healPreview}
              stroke="#5ecf9a"
              strokeWidth={brushSettings.size}
              lineCap="round"
              lineJoin="round"
              opacity={0.22}
              listening={false}
            />
          )}
          {activeTool === 'healing' && brushSettings.cloneSource && (
            <>
              <Line
                points={[
                  brushSettings.cloneSource.x - 12,
                  brushSettings.cloneSource.y,
                  brushSettings.cloneSource.x + 12,
                  brushSettings.cloneSource.y,
                ]}
                stroke="#5ecf9a"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
              <Line
                points={[
                  brushSettings.cloneSource.x,
                  brushSettings.cloneSource.y - 12,
                  brushSettings.cloneSource.x,
                  brushSettings.cloneSource.y + 12,
                ]}
                stroke="#5ecf9a"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
            </>
          )}

          {/* Real-time Brush preview while drawing */}
          {previewStroke && (
            <Line
              points={previewStroke}
              stroke={
                activeTool === 'eraser' || (activeTool === 'refineBrush' && brushSettings.refineMode === 'erase')
                  ? 'rgba(239, 68, 68, 0.7)'
                  : brushSettings.color
              }
              strokeWidth={brushSettings.size}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              opacity={brushSettings.opacity}
              listening={false}
            />
          )}

          {/* Pen tool draft preview */}
          {activeTool === 'pen' && penAnchors.length > 0 && (
            <>
              <KonvaPath
                data={anchorsToSvgPath(penAnchors, false)}
                stroke={penSettings.stroke}
                strokeWidth={penSettings.strokeWidth}
                fill={
                  penSettings.fill !== 'transparent' ? penSettings.fill : undefined
                }
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {penCursor && penAnchors.length > 0 && !penDraggingRef.current && (
                <Line
                  points={[
                    penAnchors[penAnchors.length - 1].x,
                    penAnchors[penAnchors.length - 1].y,
                    penCursor.x,
                    penCursor.y,
                  ]}
                  stroke={penSettings.stroke}
                  strokeWidth={Math.max(1, penSettings.strokeWidth * 0.75)}
                  dash={[6 / zoom, 4 / zoom]}
                  opacity={0.55}
                  listening={false}
                />
              )}
              {penAnchors.map((a, i) => (
                <React.Fragment key={`pen-a-${i}`}>
                  {(a.handleOutX || a.handleOutY) && (
                    <Line
                      points={[a.x, a.y, a.x + (a.handleOutX ?? 0), a.y + (a.handleOutY ?? 0)]}
                      stroke="#5b8def"
                      strokeWidth={1 / zoom}
                      listening={false}
                    />
                  )}
                  <Circle
                    x={a.x}
                    y={a.y}
                    radius={i === 0 ? 6 / zoom : 4 / zoom}
                    fill={i === 0 ? '#d4923a' : '#ece8e1'}
                    stroke="#1a1208"
                    strokeWidth={1 / zoom}
                    listening={false}
                  />
                </React.Fragment>
              ))}
              {penCursor &&
                penAnchors.length >= 2 &&
                dist(penCursor.x, penCursor.y, penAnchors[0].x, penAnchors[0].y) <=
                  penSettings.closeThreshold && (
                  <Circle
                    x={penAnchors[0].x}
                    y={penAnchors[0].y}
                    radius={10 / zoom}
                    stroke="#5ecf9a"
                    strokeWidth={2 / zoom}
                    listening={false}
                  />
                )}
            </>
          )}

          {/* Spot Healing / Clone cursor ring preview */}
          {(activeTool === 'spotHealing' ||
            activeTool === 'clone' ||
            activeTool === 'brush' ||
            activeTool === 'eraser' ||
            activeTool === 'refineBrush' ||
            activeTool === 'blur' ||
            activeTool === 'fill' ||
            activeTool === 'dodge' ||
            activeTool === 'burn' ||
            activeTool === 'sharpenTool' ||
            activeTool === 'healing' ||
            activeTool === 'liquify' ||
            activeTool === 'quickSelect') &&
            cursorPos && (
            <Line
              points={[cursorPos.x, cursorPos.y]}
              stroke={
                (activeTool === 'clone' && !cloneSource) ||
                (activeTool === 'healing' && !brushSettings.cloneSource)
                  ? '#e8a84a'
                  : activeTool === 'spotHealing'
                    ? '#e85d5d'
                    : activeTool === 'healing'
                      ? '#5ecf9a'
                      : activeTool === 'quickSelect'
                        ? '#5b8def'
                        : '#d4923a'
              }
              strokeWidth={
                activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sharpenTool'
                  ? toneBrushSettings.size
                  : brushSettings.size
              }
              lineCap="round"
              opacity={0.18}
              shadowBlur={(1 - brushSettings.hardness) * brushSettings.size * 0.5}
              shadowColor={brushSettings.color}
              shadowOpacity={0.4}
              listening={false}
            />
          )}

          {/* Clone Source crosshair indicator */}
          {cloneSource && activeTool === 'clone' && (
            <>
              <Line
                points={[cloneSource.x - 12, cloneSource.y, cloneSource.x + 12, cloneSource.y]}
                stroke="#facc15"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
              <Line
                points={[cloneSource.x, cloneSource.y - 12, cloneSource.x, cloneSource.y + 12]}
                stroke="#facc15"
                strokeWidth={1.5 / zoom}
                listening={false}
              />
            </>
          )}

          {/* Real-time Shape Creation Preview */}
          {shapePreviewBox && (
            <ShapePreview
              type={activeShapeType}
              box={shapePreviewBox}
              start={shapeStartRef.current}
              zoom={zoom}
            />
          )}

          {/* Marquee selection (active drag + committed) */}
          {(marqueePreview || (marqueeSelection && !marqueeSelection.path)) && (
            <>
              {(marqueeMode === 'ellipse' && marqueePreview) ||
              marqueeSelection?.mode === 'ellipse' ? (
                <Ellipse
                  x={(marqueePreview || marqueeSelection)!.x + (marqueePreview || marqueeSelection)!.width / 2}
                  y={(marqueePreview || marqueeSelection)!.y + (marqueePreview || marqueeSelection)!.height / 2}
                  radiusX={Math.abs((marqueePreview || marqueeSelection)!.width) / 2}
                  radiusY={Math.abs((marqueePreview || marqueeSelection)!.height) / 2}
                  fill="rgba(212, 146, 58, 0.12)"
                  stroke="#ece8e1"
                  strokeWidth={1 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  listening={false}
                />
              ) : (
                <Rect
                  x={(marqueePreview || marqueeSelection)!.x}
                  y={(marqueePreview || marqueeSelection)!.y}
                  width={(marqueePreview || marqueeSelection)!.width}
                  height={(marqueePreview || marqueeSelection)!.height}
                  fill="rgba(212, 146, 58, 0.12)"
                  stroke="#ece8e1"
                  strokeWidth={1 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  listening={false}
                />
              )}
            </>
          )}

          {/* Lasso path preview / committed */}
          {(lassoPreview || marqueeSelection?.path) && (
            <Line
              points={lassoPreview || marqueeSelection!.path!}
              stroke="#ece8e1"
              strokeWidth={1.25 / zoom}
              dash={[5 / zoom, 4 / zoom]}
              closed={Boolean(marqueeSelection?.path && !lassoPreview)}
              fill={marqueeSelection?.path && !lassoPreview ? 'rgba(212, 146, 58, 0.1)' : undefined}
              listening={false}
            />
          )}
        </FastLayer>

        {/* Interactive UI: crop handles + Transformer */}
        <Layer
          id="export-ui"
          x={pan.x}
          y={pan.y}
          scaleX={zoom}
          scaleY={zoom}
          listening={pointerPolicy.overlayListening || activeTool === 'select'}
        >
          {/* Crop Overlay — darkened outside, clear hole + resize handles */}
          {cropSettings.active && (() => {
            const cx = cropSettings.x;
            const cy = cropSettings.y;
            const cw = cropSettings.width;
            const ch = cropSettings.height;
            const dim = 'rgba(8, 9, 12, 0.62)';
            const handleSize = Math.max(8, 10 / zoom);
            const minSize = 20;
            const aspect = cropSettings.aspect;

            const clampCrop = (next: { x: number; y: number; width: number; height: number }) => {
              let { x, y, width, height } = next;
              width = Math.max(minSize, Math.min(width, canvasWidth));
              height = Math.max(minSize, Math.min(height, canvasHeight));
              x = Math.max(0, Math.min(x, canvasWidth - width));
              y = Math.max(0, Math.min(y, canvasHeight - height));
              return {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(width),
                height: Math.round(height),
              };
            };

            const applyAspect = (
              width: number,
              height: number,
              anchor: 'width' | 'height'
            ) => {
              if (aspect === 'free') return { width, height };
              const ratios: Record<string, number> = {
                '1:1': 1,
                '16:9': 16 / 9,
                '4:3': 4 / 3,
                '9:16': 9 / 16,
                '3:2': 3 / 2,
                '2:3': 2 / 3,
              };
              const r = ratios[aspect] ?? 1;
              if (anchor === 'width') return { width, height: Math.max(minSize, width / r) };
              return { width: Math.max(minSize, height * r), height };
            };

            type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
            const handles: { id: Handle; x: number; y: number }[] = [
              { id: 'nw', x: cx, y: cy },
              { id: 'n', x: cx + cw / 2, y: cy },
              { id: 'ne', x: cx + cw, y: cy },
              { id: 'e', x: cx + cw, y: cy + ch / 2 },
              { id: 'se', x: cx + cw, y: cy + ch },
              { id: 's', x: cx + cw / 2, y: cy + ch },
              { id: 'sw', x: cx, y: cy + ch },
              { id: 'w', x: cx, y: cy + ch / 2 },
            ];

            const computeHandleCrop = (id: Handle, posX: number, posY: number) => {
              let x1 = cx;
              let y1 = cy;
              let x2 = cx + cw;
              let y2 = cy + ch;

              if (id.includes('w')) x1 = posX;
              if (id.includes('e')) x2 = posX;
              if (id.includes('n')) y1 = posY;
              if (id.includes('s')) y2 = posY;

              if (x2 - x1 < minSize) {
                if (id.includes('w')) x1 = x2 - minSize;
                else x2 = x1 + minSize;
              }
              if (y2 - y1 < minSize) {
                if (id.includes('n')) y1 = y2 - minSize;
                else y2 = y1 + minSize;
              }

              let width = x2 - x1;
              let height = y2 - y1;

              if (aspect !== 'free') {
                const fromWidth =
                  id === 'e' || id === 'w' || id === 'ne' || id === 'se' || id === 'nw' || id === 'sw';
                const sized = applyAspect(width, height, fromWidth ? 'width' : 'height');
                width = sized.width;
                height = sized.height;
                if (id.includes('w')) x1 = x2 - width;
                else x2 = x1 + width;
                if (id.includes('n')) y1 = y2 - height;
                else y2 = y1 + height;
              }

              return clampCrop({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
            };

            const handlePos = (
              id: Handle,
              box: { x: number; y: number; width: number; height: number }
            ) => {
              const map: Record<Handle, { x: number; y: number }> = {
                nw: { x: box.x, y: box.y },
                n: { x: box.x + box.width / 2, y: box.y },
                ne: { x: box.x + box.width, y: box.y },
                e: { x: box.x + box.width, y: box.y + box.height / 2 },
                se: { x: box.x + box.width, y: box.y + box.height },
                s: { x: box.x + box.width / 2, y: box.y + box.height },
                sw: { x: box.x, y: box.y + box.height },
                w: { x: box.x, y: box.y + box.height / 2 },
              };
              return map[id];
            };

            return (
              <>
                {/* Four panels so the crop area stays bright */}
                <Rect x={0} y={0} width={canvasWidth} height={Math.max(0, cy)} fill={dim} listening={false} />
                <Rect
                  x={0}
                  y={cy}
                  width={Math.max(0, cx)}
                  height={Math.max(0, ch)}
                  fill={dim}
                  listening={false}
                />
                <Rect
                  x={cx + cw}
                  y={cy}
                  width={Math.max(0, canvasWidth - cx - cw)}
                  height={Math.max(0, ch)}
                  fill={dim}
                  listening={false}
                />
                <Rect
                  x={0}
                  y={cy + ch}
                  width={canvasWidth}
                  height={Math.max(0, canvasHeight - cy - ch)}
                  fill={dim}
                  listening={false}
                />

                <Rect
                  x={cx}
                  y={cy}
                  width={cw}
                  height={ch}
                  stroke="#d4923a"
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  fill="transparent"
                  draggable
                  dragBoundFunc={(pos) => ({
                    x: Math.max(0, Math.min(canvasWidth - cw, pos.x)),
                    y: Math.max(0, Math.min(canvasHeight - ch, pos.y)),
                  })}
                  onDragMove={(e) => {
                    const node = e.target;
                    setCropSettings({
                      x: Math.round(node.x()),
                      y: Math.round(node.y()),
                    });
                  }}
                />

                {/* Rule-of-thirds guides */}
                <Line
                  points={[cx + cw / 3, cy, cx + cw / 3, cy + ch]}
                  stroke="rgba(236,232,225,0.35)"
                  strokeWidth={1 / zoom}
                  listening={false}
                />
                <Line
                  points={[cx + (2 * cw) / 3, cy, cx + (2 * cw) / 3, cy + ch]}
                  stroke="rgba(236,232,225,0.35)"
                  strokeWidth={1 / zoom}
                  listening={false}
                />
                <Line
                  points={[cx, cy + ch / 3, cx + cw, cy + ch / 3]}
                  stroke="rgba(236,232,225,0.35)"
                  strokeWidth={1 / zoom}
                  listening={false}
                />
                <Line
                  points={[cx, cy + (2 * ch) / 3, cx + cw, cy + (2 * ch) / 3]}
                  stroke="rgba(236,232,225,0.35)"
                  strokeWidth={1 / zoom}
                  listening={false}
                />

                {handles.map((h) => (
                  <Rect
                    key={h.id}
                    x={h.x - handleSize / 2}
                    y={h.y - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    fill="#ece8e1"
                    stroke="#d4923a"
                    strokeWidth={1.5 / zoom}
                    cornerRadius={2 / zoom}
                    draggable
                    onDragMove={(e) => {
                      const node = e.target;
                      const next = computeHandleCrop(
                        h.id,
                        node.x() + handleSize / 2,
                        node.y() + handleSize / 2
                      );
                      setCropSettings(next);
                      const p = handlePos(h.id, next);
                      node.position({
                        x: p.x - handleSize / 2,
                        y: p.y - handleSize / 2,
                      });
                    }}
                  />
                ))}
              </>
            );
          })()}

          {/* Adjustment layer badges (UI layer so they never end up in exports) */}
          {(() => {
            let slot = -1;
            return layers.map((layer) => {
              if (layer.type !== 'adjustment' || !layer.visible) return null;
              slot += 1;
              return (
                <AdjustmentLayerItem
                  key={layer.id}
                  layer={layer}
                  slot={slot}
                  zoom={zoom}
                  isSelected={layer.id === selectedLayerId}
                  onSelect={() => selectLayer(layer.id)}
                />
              );
            });
          })()}

          {/* Free-Transform Box */}
          <Transformer
            ref={transformerRef}
            keepRatio={freeTransformMode ? false : keepRatio}
            rotateEnabled={!(transformToolActive && transformMode === 'scale')}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
                return oldBox;
              }
              return newBox;
            }}
            borderStroke="#d4923a"
            borderStrokeWidth={1.5 / zoom}
            anchorStroke="#d4923a"
            anchorFill="#ece8e1"
            anchorSize={8 / zoom}
            anchorCornerRadius={2 / zoom}
            rotateAnchorOffset={24 / zoom}
            enabledAnchors={transformerAnchors}
          />
        </Layer>
      </Stage>

      {/* Floating Crop Control Bar when crop tool is active */}
      {cropSettings.active && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-40">
          <span className="text-xs text-zinc-300 font-medium">
            Crop: {cropSettings.width} × {cropSettings.height} px
          </span>
          <div className="h-4 w-[1px] bg-zinc-700" />
          <button
            onClick={() => void applyCrop()}
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)] hover:brightness-110 text-[#1a1208] rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Check size={14} /> Apply Crop
          </button>
          <button
            onClick={cancelCrop}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {/* Clone Stamp status bar */}
      {activeTool === 'clone' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-zinc-300">
          {cloneSource ? (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Source set at ({cloneSource.x}, {cloneSource.y}) — Click to stamp. <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Alt+Click</kbd> to change source.
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
              <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Alt+Click</kbd> on the canvas to set a clone source point.
            </>
          )}
        </div>
      )}

      {/* Transform tool hint */}
      {transformToolActive && selectedLayerId && freeTransformMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300">
          {transformMode.charAt(0).toUpperCase() + transformMode.slice(1)} is approximated: drag any
          handle to stretch the layer unevenly, rotate with the top handle.
        </div>
      )}

      {/* Polygonal / magnetic lasso hint */}
      {(activeTool === 'polyLasso' || activeTool === 'magneticLasso') && polyPoints.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300">
          {polyPoints.length / 2} points —{' '}
          <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Enter</kbd> or
          double-click to close,{' '}
          <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Esc</kbd> to cancel
        </div>
      )}

      {/* Healing brush source hint */}
      {activeTool === 'healing' && !brushSettings.cloneSource && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
          <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">Alt+Click</kbd> to set a healing source point.
        </div>
      )}

      {/* Patch hint */}
      {activeTool === 'patch' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300">
          {marqueeSelection
            ? 'Click to patch the selected region onto that spot — drag to outline a new source.'
            : 'Drag to outline the source region, then click the destination.'}
        </div>
      )}

      {/* Spot Healing indicator */}
      {activeTool === 'spotHealing' && isHealing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-900/80 backdrop-blur-md border border-orange-500/40 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-orange-200">
          <span className="animate-spin">⟳</span> Healing...
        </div>
      )}

      {/* Eyedropper overlay */}
      {activeTool === 'eyedropper' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-zinc-300">
          <div className="w-3 h-3 rounded-full border border-zinc-600" style={{ backgroundColor: eyedropperPreview?.startsWith('#') ? eyedropperPreview : brushSettings.color }} />
          Click anywhere to sample color → sets as brush/primary color
        </div>
      )}
    </div>
  );
};

/** Live drag preview for shape tool — uses matching Konva primitives */
const ShapePreview: React.FC<{
  type: ShapeType;
  box: { x: number; y: number; width: number; height: number; x2?: number; y2?: number };
  start: { x: number; y: number } | null;
  zoom: number;
}> = ({ type, box, start, zoom }) => {
  const stroke = '#d4923a';
  const fill = 'rgba(212, 146, 58, 0.22)';
  const sw = 1.5 / zoom;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) / 2;

  if ((type === 'line' || type === 'arrow') && start && box.x2 !== undefined && box.y2 !== undefined) {
    const pts = [start.x, start.y, box.x2, box.y2];
    if (type === 'arrow') {
      return (
        <Arrow
          points={pts}
          stroke={stroke}
          fill={stroke}
          strokeWidth={sw}
          pointerLength={14 / zoom}
          pointerWidth={14 / zoom}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    }
    return (
      <Line
        points={pts}
        stroke={stroke}
        strokeWidth={sw}
        dash={[6 / zoom, 3 / zoom]}
        listening={false}
      />
    );
  }

  switch (type) {
    case 'ellipse':
      return (
        <Ellipse
          x={cx}
          y={cy}
          radiusX={box.width / 2}
          radiusY={box.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'circle':
      return (
        <Circle
          x={cx}
          y={cy}
          radius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'star':
      return (
        <Star
          x={cx}
          y={cy}
          numPoints={5}
          innerRadius={r * 0.45}
          outerRadius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'polygon':
      return (
        <RegularPolygon
          x={cx}
          y={cy}
          sides={6}
          radius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'arc':
      return (
        <Arc
          x={cx}
          y={cy}
          innerRadius={r * 0.5}
          outerRadius={r}
          angle={270}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'ring':
      return (
        <Ring
          x={cx}
          y={cy}
          innerRadius={r * 0.45}
          outerRadius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'wedge':
      return (
        <Wedge
          x={cx}
          y={cy}
          radius={r}
          angle={60}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    default:
      return (
        <Rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          cornerRadius={type === 'callout' ? 8 : 0}
          listening={false}
        />
      );
  }
};
