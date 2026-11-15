import type React from 'react';
import type { AsyncThrottler } from '@tanstack/react-pacer';
import type { ImageLayer, PathAnchor, ToolType } from '../../../types/editor';
import type { EditorStore } from '../../../store/editorStore';

export type Point = { x: number; y: number };

export type Box = { x: number; y: number; width: number; height: number };

/** Box plus the live end point (needed by line / arrow previews). */
export type ShapeBox = Box & { x2?: number; y2?: number };

export type GradientDrag = { x1: number; y1: number; x2: number; y2: number };

export type BrushStroke = {
  points: number[];
  color: string;
  size: number;
  opacity: number;
  isEraser: boolean;
  hardness?: number;
};

/** Serialized "latest wins" stroke (dodge / burn / sharpen / liquify). */
export type PointerStroke = { layerId: string; last: Point; latest: Point };

/** Liquify stroke carrying the snapshot the Reconstruct brush blends toward. */
export type LiquifyStroke = PointerStroke & { originalSrc: string };

export type HealStroke = { layerId: string; points: number[]; source: Point };

/** Luminance gradient of the selected image layer, cached for the magnetic lasso. */
export type MagneticEdgeCache = {
  layerId: string;
  src: string;
  status: 'loading' | 'ready' | 'failed';
  gradient?: Float32Array;
  /** Analysis-grid size (may be a downscale of the layer's pixels). */
  width?: number;
  height?: number;
  /** Analysis pixels per layer-local pixel. */
  scale?: number;
};

/** Corner-handle quad of the perspective / distort transform (document space, TL TR BR BL). */
export type WarpCorners = { layerId: string; key: string; points: Point[] };

export type QuickSelectBounds = { minX: number; minY: number; maxX: number; maxY: number };

export type ToolPointerEvent = {
  /** Document coordinates (already corrected for pan + zoom). */
  point: Point;
  evt: PointerEvent | MouseEvent;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

/**
 * Mutable per-stage scratch space shared between tool handlers and the CanvasStage shell.
 *
 * It is a plain object (kept in a `useState` initialiser, never replaced) so handlers can
 * mutate it synchronously inside pointer events. Anything the shell needs to paint is read
 * from here during render; handlers call `ctx.requestRedraw()` when they change something
 * outside a pointer event (the dispatcher already redraws after every pointer event).
 */
export interface ToolSession {
  cursorPos: Point | null;
  /** Tool that received the current pointer-down (so pointer-up reaches the same handler). */
  downTool: ToolType | null;

  // Pan (Hand tool, Space+drag, middle mouse)
  spacePressed: boolean;
  panning: boolean;
  panStart: Point | null;

  // Brush / eraser / refine brush
  brushStroke: BrushStroke | null;
  brushPreview: number[] | null;

  // Shape tool
  shapeStart: Point | null;
  shapePreview: ShapeBox | null;

  // Marquee + freehand lasso
  marqueeStart: Point | null;
  marqueePreview: Box | null;
  lassoDrawing: boolean;
  lassoPreview: number[] | null;

  // Polygonal / magnetic lasso (flat [x,y,...])
  polyPoints: number[];
  magneticDragging: boolean;
  magneticEdge: MagneticEdgeCache | null;

  // Quick select
  quickSelect: QuickSelectBounds | null;

  // Clone stamp, spot healing, blur
  cloneSource: Point | null;
  cloneOffset: Point | null;
  cloning: boolean;
  spotHealing: boolean;
  blurring: boolean;

  // Healing brush + patch
  healStroke: HealStroke | null;
  healPreview: number[] | null;
  patchDrawing: boolean;
  patchPreview: number[] | null;

  // Gradient
  gradientDrag: GradientDrag | null;

  // Dodge / burn / sharpen / liquify
  toneStroke: PointerStroke | null;
  liquifyStroke: LiquifyStroke | null;
  /** Pre-liquify pixels per layer, captured the first time the brush touches it (Reconstruct target). */
  liquifyOriginals: Map<string, string>;
  runner: { busy: boolean; pending: (() => Promise<void>) | null };

  // Pen
  penAnchors: PathAnchor[];
  penDragging: boolean;
  penCursor: Point | null;

  // Perspective / distort corner handles
  warpCorners: WarpCorners | null;
  warpBusy: boolean;

  // Eyedropper
  eyedropperPreview: string | null;

  /** Lazily created async throttlers, keyed by tool. */
  throttlers: Map<string, AsyncThrottler<any>>;
}

export type ToolView = {
  zoom: number;
  pan: Point;
  canvasWidth: number;
  canvasHeight: number;
};

export type ToolContext = {
  /** Tool the handler is currently being invoked for (relevant for multi-id handlers). */
  tool: ToolType;
  /** Always the latest store snapshot (never a render closure). */
  getStore: () => EditorStore;
  getSelectedImageLayer: () => ImageLayer | null;
  getView: () => ToolView;
  session: ToolSession;
  /** Re-render the stage so overlays reflect `session`. */
  requestRedraw: () => void;
};

/**
 * One tool = one handler module + one `registerTool` call.
 *
 * `onPointerDown` may return `false` to pass the event back to the shell (e.g. to deselect on
 * the empty canvas); returning nothing / `true` marks it as handled.
 */
export interface ToolHandler {
  id: ToolType | ToolType[];
  onPointerDown?: (
    e: ToolPointerEvent,
    ctx: ToolContext
  ) => void | boolean | Promise<void | boolean>;
  onPointerMove?: (e: ToolPointerEvent, ctx: ToolContext) => void;
  onPointerUp?: (e: ToolPointerEvent, ctx: ToolContext) => void | Promise<void>;
  onKeyDown?: (e: KeyboardEvent, ctx: ToolContext) => void;
  /** Called when the tool stops being active (drop drafts / in-progress gestures). */
  onDeactivate?: (ctx: ToolContext) => void;
  /** Konva nodes drawn in the document-space overlay layer while the tool is active. */
  renderOverlay?: (ctx: ToolContext) => React.ReactNode;
  /** Interactive Konva nodes drawn in the (listening) UI layer, next to the Transformer. */
  renderUi?: (ctx: ToolContext) => React.ReactNode;
  /** DOM hints / status bars drawn above the stage while the tool is active. */
  renderHud?: (ctx: ToolContext) => React.ReactNode;
  /** Tailwind cursor class; falls back to `listeningPolicy` when omitted / undefined. */
  cursor?: (ctx: ToolContext) => string | undefined;
}
