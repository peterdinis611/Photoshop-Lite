import type { EditorLayer, ToolType, TransformMode } from '../../../types/editor';
import type { ToolHandler } from './types';

export type TransformerConfig = {
  transformToolActive: boolean;
  /** Skew / distort / perspective / warp can only be approximated by Konva's Transformer. */
  freeTransformMode: boolean;
  anchors: string[] | undefined;
  rotateEnabled: boolean;
};

/** Transformer behaviour for the active tool, selected layer and transform mode. */
export function getTransformerConfig(
  activeTool: ToolType,
  transformMode: TransformMode,
  selectedLayer: EditorLayer | undefined
): TransformerConfig {
  const transformToolActive = activeTool === 'transform';
  const freeTransformMode =
    transformToolActive && ['skew', 'distort', 'perspective', 'warp'].includes(transformMode);
  const isLineLikeShape =
    selectedLayer?.type === 'shape' && ['line', 'arrow'].includes(selectedLayer.shapeType);
  const anchors: string[] | undefined = isLineLikeShape
    ? ['middle-left', 'middle-right', 'top-center', 'bottom-center']
    : transformToolActive && transformMode === 'rotate'
      ? []
      : transformToolActive && transformMode === 'scale'
        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        : undefined;
  return {
    transformToolActive,
    freeTransformMode,
    anchors,
    rotateEnabled: !(transformToolActive && transformMode === 'scale'),
  };
}

/**
 * The Transformer itself lives in CanvasStage (it needs the selected Konva node); this handler
 * only owns the transform tool's hint and cursor.
 */
export const transformTool: ToolHandler = {
  id: 'transform',

  cursor: () => 'cursor-default',

  renderHud: (ctx) => {
    const { selectedLayerId, transformMode, layers } = ctx.getStore();
    const { freeTransformMode } = getTransformerConfig(
      'transform',
      transformMode,
      layers.find((l) => l.id === selectedLayerId)
    );
    if (!selectedLayerId || !freeTransformMode) return null;
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl z-40 text-xs text-zinc-300">
        {transformMode.charAt(0).toUpperCase() + transformMode.slice(1)} is approximated: drag any
        handle to stretch the layer unevenly, rotate with the top handle.
      </div>
    );
  },
};
