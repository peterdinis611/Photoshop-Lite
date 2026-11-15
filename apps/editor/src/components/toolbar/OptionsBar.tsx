import React from 'react';
import { Move } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { ToolType } from '../../types/editor';
import {
  BrushOptions,
  CropOptions,
  DefaultOptions,
  GradientOptions,
  HealingOptions,
  LiquifyOptions,
  PenOptions,
  SelectionOptions,
  ShapeOptions,
  TextOptions,
  ToneBrushOptions,
  TransformOptions,
} from './options';

const TOOL_LABEL: Record<ToolType, string> = {
  select: 'Move',
  marquee: 'Marquee',
  lasso: 'Lasso',
  polyLasso: 'Polygonal Lasso',
  magneticLasso: 'Magnetic Lasso',
  quickSelect: 'Quick Select',
  wand: 'Wand',
  crop: 'Crop',
  brush: 'Brush',
  eraser: 'Eraser',
  refineBrush: 'Refine Edge',
  spotHealing: 'Spot Heal',
  healing: 'Healing Brush',
  patch: 'Patch',
  gradient: 'Gradient',
  dodge: 'Dodge',
  burn: 'Burn',
  sharpenTool: 'Sharpen',
  liquify: 'Liquify',
  transform: 'Transform',
  clone: 'Clone Stamp',
  eyedropper: 'Eyedropper',
  fill: 'Paint Bucket',
  blur: 'Blur',
  text: 'Type',
  shape: 'Shape',
  pen: 'Pen',
  hand: 'Hand',
  zoom: 'Zoom',
};

const renderToolOptions = (tool: ToolType): React.ReactNode => {
  switch (tool) {
    case 'select':
    case 'hand':
    case 'zoom':
    case 'eyedropper':
      return <DefaultOptions tool={tool} />;
    case 'marquee':
    case 'lasso':
    case 'polyLasso':
    case 'magneticLasso':
    case 'quickSelect':
    case 'wand':
      return <SelectionOptions tool={tool} />;
    case 'brush':
    case 'eraser':
    case 'clone':
    case 'spotHealing':
    case 'fill':
    case 'blur':
    case 'refineBrush':
      return <BrushOptions tool={tool} />;
    case 'gradient':
      return <GradientOptions />;
    case 'dodge':
    case 'burn':
    case 'sharpenTool':
      return <ToneBrushOptions tool={tool} />;
    case 'healing':
    case 'patch':
      return <HealingOptions tool={tool} />;
    case 'liquify':
      return <LiquifyOptions />;
    case 'transform':
      return <TransformOptions />;
    case 'crop':
      return <CropOptions />;
    case 'text':
      return <TextOptions />;
    case 'pen':
      return <PenOptions />;
    case 'shape':
      return <ShapeOptions />;
    default:
      return null;
  }
};

export const OptionsBar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);

  return (
    <div className="shell-options h-9 bg-[var(--bg-toolbar)] border-b border-[var(--border-subtle)] px-3 flex items-center gap-3 text-[11px] text-[var(--text-muted)] select-none overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-[var(--border-subtle)]">
        <Move size={12} className="text-[var(--accent)]" />
        <span className="font-display font-bold text-[var(--text-primary)] text-[11px]">
          {TOOL_LABEL[activeTool] || activeTool}
        </span>
      </div>
      {renderToolOptions(activeTool)}
    </div>
  );
};
