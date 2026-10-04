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
  | 'marquee'
  | 'lasso'
  | 'wand'
  | 'hand'
  | 'zoom';

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

export type EditorLayer = ImageLayer | TextLayer | ShapeLayer | DrawingLayer;

export interface BrushSettings {
  size: number;
  color: string;
  opacity: number;
  hardness: number;
  refineMode: 'erase' | 'restore'; // for background edge refinement
  cloneSource?: { x: number; y: number } | null; // for clone stamp
}

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
}
