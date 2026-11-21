import React, { useRef, useEffect, useEffectEvent, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, FastLayer, Transformer, Rect, Line, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { useThrottledCallback } from '@tanstack/react-pacer';
import { registerStage, listeningPolicy } from '@photoshop-lite/editor-konva';
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
// Importing the tools index registers every tool handler (pointer logic lives there)
import {
  useToolDispatch,
  renderSelectionOverlay,
  getTransformerConfig,
  CropOverlay,
  CropControlBar,
  type ToolContext,
} from './tools';

/** Snap distance to guides, in screen pixels */
const GUIDE_SNAP_PX = 6;

interface CanvasStageProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Canvas shell: owns the Konva stage, layer rendering, artboards, guides and the Transformer.
 * Everything tool-specific (pointer handling, drafts, overlays, hints) is dispatched to the
 * handlers registered in `./tools`.
 */
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
    cropSettings,
    layers,
    selectedLayerId,
    setZoom,
    setPan,
    selectLayer,
    updateLayer,
    setCropSettings,
    applyCrop,
    cancelCrop,
    artboards,
    activeArtboardId,
    setMarqueeSelection,
    guides,
    snapToGuides,
    transformMode,
  } = useEditorStore();

  // Image layers with any adjustment layers above them folded into their filter settings
  const renderLayers = useMemo(() => applyAdjustmentLayers(layers), [layers]);

  const [containerSize, setContainerSize] = useState({ width: 1000, height: 700 });
  const [keepRatio, setKeepRatio] = useState(false);

  // Click on the empty canvas (tools without a pointer-down handler): deselect everything
  const handleUnhandledPointerDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>, toolCtx: ToolContext) => {
      if (e.target === e.target.getStage() || e.target.name() === 'canvas-bg') {
        selectLayer(null);
        setMarqueeSelection(null);
        toolCtx.session.lassoPreview = null;
      }
    },
    [selectLayer, setMarqueeSelection]
  );

  const dispatch = useToolDispatch({
    activeTool,
    onUnhandledPointerDown: handleUnhandledPointerDown,
  });
  const { session, ctx, onKeyDown: onToolKeyDown } = dispatch;

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

  // Space (pan) / Shift (keep ratio) + the active tool's key bindings (Enter / Esc, ...)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setKeepRatio(true);
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        session.spacePressed = true;
        ctx.requestRedraw();
      }
      onToolKeyDown(e);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setKeepRatio(false);
      if (e.code === 'Space') {
        session.spacePressed = false;
        session.panning = false;
        ctx.requestRedraw();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [ctx, onToolKeyDown, session]);

  const selectedLayerForTransform = layers.find((l) => l.id === selectedLayerId);
  const { freeTransformMode, cornerWarpMode, anchors, rotateEnabled } = getTransformerConfig(
    activeTool,
    transformMode,
    selectedLayerForTransform
  );

  // Update Transformer selection (Effect Event keeps latest ids without rebinding)
  const syncTransformer = useEffectEvent(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (
      (activeTool !== 'select' && activeTool !== 'transform') ||
      !selectedLayerId ||
      cornerWarpMode
    ) {
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
  }, [selectedLayerId, activeTool, layers, cornerWarpMode]);

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

  const pointerPolicy = listeningPolicy(activeTool);


  const getCursorClass = () => {
    if (session.spacePressed || session.panning) return 'cursor-grab active:cursor-grabbing';
    const fromTool = dispatch.cursorClass();
    if (fromTool) return fromTool;
    if (pointerPolicy.cursor === 'crosshair') return 'cursor-crosshair';
    if (pointerPolicy.cursor === 'grab') return 'cursor-grab active:cursor-grabbing';
    return 'cursor-default';
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-[var(--bg-app)] ${getCursorClass()}`}
      onWheel={handleWheel}
      onMouseLeave={dispatch.onMouseLeave}
    >
      {/* Rulers */}
      {showRulers && (
        <CanvasRulers
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoom={zoom}
          pan={pan}
          cursorPos={session.cursorPos}
        />
      )}

      {/* Main Konva Stage — content vs UI split so export matches preview */}
      <Stage
        ref={setStageRef}
        width={containerSize.width}
        height={containerSize.height}
        listening={pointerPolicy.stageListening}
        onMouseDown={dispatch.onMouseDown}
        onMouseMove={dispatch.onMouseMove}
        onMouseUp={dispatch.onMouseUp}
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
            if (layer.type === 'group') return null;
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

          {/* Active tool previews (gradient drag, lasso draft, pen path, brush ring, ...) */}
          {dispatch.renderOverlay()}

          {/* Drag preview + committed marquee / lasso selection (visible for every tool) */}
          {renderSelectionOverlay(ctx)}
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
          {cropSettings.active && (
            <CropOverlay
              cropSettings={cropSettings}
              zoom={zoom}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              setCropSettings={setCropSettings}
            />
          )}

          {/* Active tool's interactive handles (perspective / distort corners) */}
          {dispatch.renderUi()}

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
            rotateEnabled={rotateEnabled}
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
            enabledAnchors={anchors}
          />
        </Layer>
      </Stage>

      {/* Floating Crop Control Bar when crop tool is active */}
      {cropSettings.active && (
        <CropControlBar cropSettings={cropSettings} applyCrop={applyCrop} cancelCrop={cancelCrop} />
      )}

      {/* Active tool hints / status bars */}
      {dispatch.renderHud()}
    </div>
  );
};
