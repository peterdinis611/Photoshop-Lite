import React, { useRef, useEffect, useEffectEvent, useState, useCallback } from 'react';
import { Stage, Layer, Transformer, Rect, Line, Ellipse, Arrow, Circle, Star, RegularPolygon, Arc, Ring, Wedge } from 'react-konva';
import Konva from 'konva';
import { useAsyncThrottledCallback, useThrottledCallback } from '@tanstack/react-pacer';
import { useEditorStore } from '../../store/editorStore';
import { ImageLayerItem } from './ImageLayerItem';
import { TextLayerItem } from './TextLayerItem';
import { ShapeLayerItem } from './ShapeLayerItem';
import { DrawingLayerItem } from './DrawingLayerItem';
import { CanvasRulers } from './CanvasRulers';
import { Check, X } from 'lucide-react';
import {
  applySpotHealingToImage,
  applyCloneStampToImage,
  sampleCanvasColor,
  floodFillImage,
  applyBlurSpotToImage,
} from '../../utils/retouchHelpers';
import { registerStage } from '../../utils/stageRegistry';
import { paintStrokeOnMask, magicWandBounds } from '../../utils/maskHelpers';
import type { ShapeType } from '../../types/editor';

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
    cropSettings,
    layers,
    selectedLayerId,
    setZoom,
    setPan,
    selectLayer,
    updateLayer,
    addDrawingStroke,
    addShapeLayer,
    setCropSettings,
    applyCrop,
    cancelCrop,
    updateBrushSettings,
    marqueeSelection,
    setMarqueeSelection,
    marqueeMode,
    wandTolerance,
    paintLayerMask,
    commitHistory,
  } = useEditorStore();

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

  // Spot Healing state
  const [isHealing, setIsHealing] = useState(false);

  // Blur tool state
  const [isBlurring, setIsBlurring] = useState(false);

  // Eyedropper cursor color preview
  const [eyedropperPreview, setEyedropperPreview] = useState<string | null>(null);

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

  // Space key listener for hand/pan
  // Space / Shift key listener for hand/pan and transform ratio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setKeepRatio(true);
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setIsSpacePressed(true);
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
  }, [activeTool]);

  // Update Transformer selection (Effect Event keeps latest ids without rebinding)
  const syncTransformer = useEffectEvent(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (activeTool !== 'select' || !selectedLayerId) {
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
          tolerance: 32,
        });
        if (filled) {
          updateLayer(imageLayer.id, { src: filled });
        }
      }
      return;
    }

    // Blur tool
    if (activeTool === 'blur') {
      setIsBlurring(true);
      void applyBlurThrottled(coords);
      return;
    }

    // Spot Healing Brush
    if (activeTool === 'spotHealing') {
      const imageLayer = getSelectedImageLayer();
      if (imageLayer && !isHealing) {
        setIsHealing(true);
        const newSrc = await applySpotHealingToImage(
          imageLayer.src,
          imageLayer.x,
          imageLayer.y,
          coords.x,
          coords.y,
          brushSettings.size / 2
        );
        updateLayer(imageLayer.id, { src: newSrc });
        setIsHealing(false);
      }
      return;
    }

    // Clone Stamp
    if (activeTool === 'clone') {
      if (e.evt.altKey) {
        // Alt+Click: set clone source
        setCloneSource({ x: coords.x, y: coords.y });
        updateBrushSettings({ cloneSource: { x: coords.x, y: coords.y } });
        return;
      }
      if (cloneSource) {
        const imageLayer = getSelectedImageLayer();
        if (imageLayer) {
          const newSrc = await applyCloneStampToImage(
            imageLayer.src,
            imageLayer.x,
            imageLayer.y,
            cloneSource.x,
            cloneSource.y,
            coords.x,
            coords.y,
            brushSettings.size / 2,
            brushSettings.opacity
          );
          updateLayer(imageLayer.id, { src: newSrc });
        }
      }
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
  };

  const handleMouseUp = async () => {
    if (isBlurring) {
      setIsBlurring(false);
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

      // Refine brush on a masked image → paint the layer mask
      const imageLayer = getSelectedImageLayer();
      if (
        activeTool === 'refineBrush' &&
        imageLayer?.hasLayerMask &&
        imageLayer.layerMaskSrc
      ) {
        commitHistory('Paint Layer Mask');
        const newMask = await paintStrokeOnMask({
          maskSrc: imageLayer.layerMaskSrc,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          layerWidth: imageLayer.width,
          layerHeight: imageLayer.height,
          points: stroke.points,
          size: stroke.size,
          erase: stroke.isEraser,
        });
        paintLayerMask(imageLayer.id, newMask);
      } else {
        const drawingLayer = layers.find((l) => l.type === 'drawing');
        addDrawingStroke(drawingLayer?.id || 'new', stroke);
      }
    }

    if (isCreatingShape && shapePreviewBox && shapeStartRef.current) {
      setIsCreatingShape(false);
      const { x, y, width, height, x2, y2 } = shapePreviewBox;
      const start = shapeStartRef.current;
      if (width > 5 || height > 5 || (x2 !== undefined && y2 !== undefined)) {
        addShapeLayer(activeShapeType);
        setTimeout(() => {
          const currentSelected = useEditorStore.getState().selectedLayerId;
          if (!currentSelected) return;
          const isLineLike = activeShapeType === 'line' || activeShapeType === 'arrow';
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
  };

  // Cursor style computation
  const getCursorClass = () => {
    if (isSpacePressed || isPanning || activeTool === 'hand') return 'cursor-grab active:cursor-grabbing';
    if (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'refineBrush') return 'cursor-crosshair';
    if (activeTool === 'marquee' || activeTool === 'lasso' || activeTool === 'wand') return 'cursor-crosshair';
    if (activeTool === 'spotHealing') return 'cursor-crosshair';
    if (activeTool === 'fill' || activeTool === 'blur') return 'cursor-crosshair';
    if (activeTool === 'clone') return cloneSource ? 'cursor-crosshair' : 'cursor-copy';
    if (activeTool === 'eyedropper') return 'cursor-crosshair';
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'shape' || activeTool === 'crop') return 'cursor-crosshair';
    if (activeTool === 'zoom') return 'cursor-zoom-in';
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer id="export-content" x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
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
          {layers.map((layer) => {
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
            return null;
          })}
        </Layer>

        <Layer id="export-ui" x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom} listening>
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

          {/* Spot Healing / Clone cursor ring preview */}
          {(activeTool === 'spotHealing' ||
            activeTool === 'clone' ||
            activeTool === 'brush' ||
            activeTool === 'eraser' ||
            activeTool === 'blur' ||
            activeTool === 'fill') &&
            cursorPos && (
            <Line
              points={[cursorPos.x, cursorPos.y]}
              stroke={activeTool === 'clone' && !cloneSource ? '#e8a84a' : activeTool === 'spotHealing' ? '#e85d5d' : '#d4923a'}
              strokeWidth={brushSettings.size}
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

          {/* Crop Overlay when crop tool is active */}
          {cropSettings.active && (
            <>
              <Rect
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fill="rgba(0, 0, 0, 0.65)"
                listening={false}
              />
              <Rect
                x={cropSettings.x}
                y={cropSettings.y}
                width={cropSettings.width}
                height={cropSettings.height}
                stroke="#d4923a"
                strokeWidth={2 / zoom}
                dash={[8 / zoom, 4 / zoom]}
                draggable
                onDragMove={(e) => {
                  setCropSettings({
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  });
                }}
              />
            </>
          )}

          {/* Free-Transform Box */}
          <Transformer
            ref={transformerRef}
            keepRatio={keepRatio}
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
            enabledAnchors={
              selectedLayerId &&
              layers.find((l) => l.id === selectedLayerId)?.type === 'shape' &&
              ['line', 'arrow'].includes(
                (layers.find((l) => l.id === selectedLayerId) as { shapeType?: string })?.shapeType ||
                  ''
              )
                ? ['middle-left', 'middle-right', 'top-center', 'bottom-center']
                : undefined
            }
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
            onClick={applyCrop}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
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
