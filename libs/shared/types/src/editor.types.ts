export type ToolType =
  | 'select'
  | 'crop'
  | 'brush'
  | 'eraser'
  | 'refineBrush'
  | 'spotHealing'
  | 'clone'
  | 'eyedropper'
  | 'fill'
  | 'blur'
  | 'text'
  | 'shape'
  | 'pen'
  | 'marquee'
  | 'lasso'
  | 'wand'
  | 'hand'
  | 'zoom'
  | 'gradient'
  | 'dodge'
  | 'burn'
  | 'sharpenTool'
  | 'polyLasso'
  | 'magneticLasso'
  | 'quickSelect'
  | 'healing'
  | 'patch'
  | 'liquify'
  | 'transform';

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'star'
  | 'polygon'
  | 'arc'
  | 'ring'
  | 'wedge'
  | 'callout';

export type MarqueeMode = 'rect' | 'ellipse';

export type SelectionShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  mode?: MarqueeMode;
  /** Closed freehand path for lasso (document coords, flat [x,y,...]) */
  path?: number[];
};

export type BlendMode =
  | 'source-over' // Normal
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface CurvesAdjustment {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface LevelsAdjustment {
  inBlack: number; // 0-255
  inWhite: number; // 0-255
  inGamma: number; // 0.1-9.99, default 1
  outBlack: number; // 0-255
  outWhite: number; // 0-255
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  exposure: number; // -100 to 100
  sharpness: number; // 0 to 100
  blur: number; // 0 to 40
  vibrance: number; // -100 to 100
  temperature: number; // -100 to 100 (warm/cool)
  tint: number; // -100 to 100 (green/magenta)
  hue: number; // -180 to 180
  invert: boolean;
  grayscale: boolean;
  sepia: boolean;
  curves?: CurvesAdjustment;
  levels?: LevelsAdjustment;
}

export interface LayerStyles {
  stroke?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  outerGlowColor?: string;
  outerGlowBlur?: number;
}

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees
  styles?: LayerStyles;
  clippingMaskToId?: string; // clips this layer to the shape/text below it
  hasLayerMask?: boolean; // non-destructive layer mask
  layerMaskSrc?: string; // black/white alpha mask data URL
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string; // current active data URL / image src
  originalSrc: string; // unmodified source for non-destructive edits
  adjustments: ImageAdjustments;
  preset?: string;
  maskDataUrl?: string; // transparent mask after bg removal or refine
  smartObject?: boolean;
  smartObjectSrc?: string; // linked original
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  align: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  lineHeight: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  sides?: number; // for polygon / star
  starInnerRadius?: number;
  points?: number[]; // for line / arrow / callout
  /** Arc / wedge sweep angle in degrees (default 270 / 60) */
  angle?: number;
  /** Ring inner radius as fraction of outer (0–1), or star inner fraction */
  innerRadius?: number;
}

export interface BrushStroke {
  points: number[];
  color: string;
  size: number;
  opacity: number;
  isEraser: boolean;
  hardness?: number;
}

export interface DrawingLayer extends BaseLayer {
  type: 'drawing';
  strokes: BrushStroke[];
}

/** Bezier path anchor — handles are offsets from the anchor point. */
export interface PathAnchor {
  x: number;
  y: number;
  handleInX?: number;
  handleInY?: number;
  handleOutX?: number;
  handleOutY?: number;
}

export interface PathLayer extends BaseLayer {
  type: 'path';
  anchors: PathAnchor[];
  closed: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type AdjustmentLayerKind =
  | 'brightness'
  | 'contrast'
  | 'levels'
  | 'curves'
  | 'hueSaturation'
  | 'invert'
  | 'grayscale';

export interface AdjustmentLayer extends BaseLayer {
  type: 'adjustment';
  kind: AdjustmentLayerKind;
  adjustments: ImageAdjustments; // reused; curves/levels live here
  affectedChannel?: 'rgb' | 'red' | 'green' | 'blue';
}

export interface GradientLayer extends BaseLayer {
  type: 'gradient';
  gradientType: 'linear' | 'radial';
  colorStops: { offset: number; color: string }[];
  angle: number; // for linear
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export type EditorLayer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | DrawingLayer
  | PathLayer
  | AdjustmentLayer
  | GradientLayer;

export interface PenSettings {
  stroke: string;
  strokeWidth: number;
  fill: string;
  /** Auto-close when clicking near the first point */
  closeThreshold: number;
}

export interface ShapeSettings {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  opacity: number;
}

export interface TextSettings {
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  align: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  lineHeight: number;
  stroke: string;
  strokeWidth: number;
}

export interface BrushSettings {
  size: number;
  color: string;
  opacity: number;
  hardness: number;
  flow: number; // 0-1
  refineMode: 'erase' | 'restore'; // for background edge refinement
  cloneSource?: { x: number; y: number } | null; // for clone stamp
}

export interface GradientSettings {
  gradientType: 'linear' | 'radial';
  colorStops: { offset: number; color: string }[];
  opacity: number;
}

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  gradientType: 'linear',
  colorStops: [
    { offset: 0, color: '#000000' },
    { offset: 1, color: '#ffffff' },
  ],
  opacity: 1,
};

export interface ToneBrushSettings {
  size: number;
  hardness: number;
  exposure: number; // 0-100
  range: 'shadows' | 'midtones' | 'highlights';
}

export const DEFAULT_TONE_BRUSH: ToneBrushSettings = {
  size: 64,
  hardness: 0.4,
  exposure: 35,
  range: 'midtones',
};

export interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
}

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
}

export interface EditorActionStep {
  id: string;
  label: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface EditorAction {
  id: string;
  name: string;
  steps: EditorActionStep[];
}

export type TransformMode =
  | 'free'
  | 'scale'
  | 'rotate'
  | 'skew'
  | 'distort'
  | 'perspective'
  | 'warp';

export const DEFAULT_PEN_SETTINGS: PenSettings = {
  stroke: '#d4923a',
  strokeWidth: 2,
  fill: 'transparent',
  closeThreshold: 12,
};

export const DEFAULT_SHAPE_SETTINGS: ShapeSettings = {
  fill: '#d4923a',
  stroke: '#ece8e1',
  strokeWidth: 2,
  cornerRadius: 12,
  opacity: 1,
};

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  fill: '#ece8e1',
  fontFamily: 'Source Sans 3',
  fontSize: 36,
  fontStyle: 'bold',
  align: 'center',
  letterSpacing: 0,
  lineHeight: 1.2,
  stroke: 'transparent',
  strokeWidth: 0,
};

export interface CropSettings {
  active: boolean;
  aspect: 'free' | '1:1' | '16:9' | '4:3' | '9:16' | '3:2' | '2:3';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface HistorySnapshot {
  id: string;
  name: string;
  timestamp: number;
  layers: EditorLayer[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}

export interface AIStatus {
  isProcessing: boolean;
  action:
    | 'remove-bg'
    | 'upscale'
    | 'auto-enhance'
    | 'revive'
    | 'cleanup'
    | 'healing'
    | 'face-restore'
    | 'inpaint'
    | 'object-remove'
    | 'style'
    | 'relight'
    | 'portrait-polish'
    | 'clarity'
    | 'color-match'
    | 'outpaint'
    | 'batch'
    | 'segment'
    | 'caption'
    | null;
  progress: number;
  statusText: string;
  error?: string;
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality: number; // 0.1 to 1.0
  scale: number; // 1, 2, 0.5
  transparentBackground: boolean;
  fileName: string;
}

export interface SmartGuide {
  type: 'vertical' | 'horizontal';
  pos: number;
}

export interface ProjectFileData {
  version: '1.0';
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: EditorLayer[];
  savedAt: string;
  guides?: Guide[];
  artboards?: Artboard[];
  activeArtboardId?: string | null;
  actions?: EditorAction[];
}
