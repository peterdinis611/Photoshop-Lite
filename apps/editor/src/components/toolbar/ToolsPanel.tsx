import React, { useState } from 'react';
import {
  MousePointer,
  Crop,
  Paintbrush,
  Eraser,
  Sparkles,
  Type,
  Square,
  Circle,
  ArrowRight,
  Star,
  Stamp,
  Hand,
  Search,
  ArrowLeftRight,
  Pipette,
  Bandage,
  GitCompare,
  Hexagon,
  Minus,
  Lasso,
  WandSparkles,
  Ellipse,
  Pentagon,
  Disc,
  PieChart,
  MessageSquare,
  ChevronRight,
  PaintBucket,
  Droplets,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { ToolType, ShapeType } from '../../types/editor';
import { BeforeAfterSlider } from '../canvas/BeforeAfterSlider';
import { ColorField } from '../ui/ColorField';

interface ToolItem {
  id: ToolType | 'beforeAfter' | 'marqueeMenu' | 'brushMenu';
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  separator?: boolean;
}

const BRUSH_SIZES = [4, 12, 24, 48, 80];
const QUICK_COLORS = ['#d4923a', '#ece8e1', '#0b0c0f', '#e85d5d', '#5ecf9a', '#5b8def', '#ffffff'];

export const ToolsPanel: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    activeShapeType,
    setActiveShapeType,
    brushSettings,
    updateBrushSettings,
    addTextLayer,
    addShapeLayer,
    marqueeMode,
    setMarqueeMode,
    secondaryColor,
    setSecondaryColor,
    swapBrushColors,
    resetBrushColors,
    isBeforeAfterOpen,
    setBeforeAfterOpen,
  } = useEditorStore();

  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showMarqueeMenu, setShowMarqueeMenu] = useState(false);
  const [showBrushMenu, setShowBrushMenu] = useState(false);

  const tools: ToolItem[] = [
    {
      id: 'select',
      label: 'Move / Selection Tool',
      shortcut: 'V',
      icon: <MousePointer size={18} />,
    },
    {
      id: 'marqueeMenu',
      label: 'Marquee Tools',
      shortcut: 'M',
      icon:
        marqueeMode === 'ellipse' ? (
          <Ellipse size={18} className="text-sky-400" />
        ) : (
          <Square size={18} className="text-sky-400" />
        ),
    },
    {
      id: 'lasso',
      label: 'Lasso Selection',
      shortcut: 'L',
      icon: <Lasso size={18} className="text-sky-300" />,
    },
    {
      id: 'wand',
      label: 'Magic Wand',
      shortcut: 'W',
      icon: <WandSparkles size={18} className="text-violet-300" />,
    },
    {
      id: 'crop',
      label: 'Crop & Rotate',
      shortcut: 'C',
      icon: <Crop size={18} />,
      separator: true,
    },
    {
      id: 'brushMenu',
      label: 'Brush Tool — color & size',
      shortcut: 'B',
      icon: (
        <div className="relative">
          <Paintbrush size={18} />
          <ChevronRight size={9} className="absolute -right-0.5 -bottom-0.5 opacity-70" />
        </div>
      ),
    },
    {
      id: 'eraser',
      label: 'Eraser Tool',
      shortcut: 'E',
      icon: <Eraser size={18} />,
    },
    {
      id: 'fill',
      label: 'Paint Bucket — Flood Fill',
      shortcut: 'G',
      icon: <PaintBucket size={18} className="text-sky-300" />,
    },
    {
      id: 'blur',
      label: 'Blur Tool',
      shortcut: 'R',
      icon: <Droplets size={18} className="text-cyan-300" />,
    },
    {
      id: 'refineBrush',
      label: 'Edge Refinement Brush (Fix Cutouts)',
      shortcut: 'Shift+R',
      icon: <Sparkles size={18} className="text-amber-400" />,
    },
    {
      id: 'spotHealing',
      label: 'Spot Healing Brush (Remove Blemishes)',
      shortcut: 'J',
      icon: <Bandage size={18} className="text-orange-400" />,
    },
    {
      id: 'clone',
      label: 'Clone Stamp — Alt+Click to set source',
      shortcut: 'S',
      icon: <Stamp size={18} />,
      separator: true,
    },
    {
      id: 'eyedropper',
      label: 'Eyedropper — Sample Color',
      shortcut: 'I',
      icon: <Pipette size={18} className="text-emerald-400" />,
    },
    {
      id: 'text',
      label: 'Horizontal Type Tool',
      shortcut: 'T',
      icon: <Type size={18} />,
    },
    {
      id: 'shape',
      label: 'Shape Tool',
      shortcut: 'U',
      icon: (
        <div className="relative">
          {activeShapeType === 'circle' || activeShapeType === 'ellipse' ? (
            <Circle size={18} />
          ) : activeShapeType === 'arrow' ? (
            <ArrowRight size={18} />
          ) : activeShapeType === 'star' ? (
            <Star size={18} />
          ) : activeShapeType === 'callout' ? (
            <MessageSquare size={18} />
          ) : (
            <Square size={18} />
          )}
          <ChevronRight size={9} className="absolute -right-0.5 -bottom-0.5 opacity-70" />
        </div>
      ),
      separator: true,
    },
    {
      id: 'hand',
      label: 'Hand Tool (Pan)',
      shortcut: 'H',
      icon: <Hand size={18} />,
    },
    {
      id: 'zoom',
      label: 'Zoom Tool',
      shortcut: 'Z',
      icon: <Search size={18} />,
    },
    {
      id: 'beforeAfter',
      label: 'Before / After Comparison',
      shortcut: '\\',
      icon: <GitCompare size={18} className="text-[var(--accent-hot)]" />,
      separator: true,
    },
  ];

  const shapes: { type: ShapeType; label: string; icon: React.ReactNode }[] = [
    { type: 'rectangle', label: 'Rectangle', icon: <Square size={14} /> },
    { type: 'ellipse', label: 'Ellipse', icon: <Ellipse size={14} /> },
    { type: 'circle', label: 'Circle', icon: <Circle size={14} /> },
    { type: 'line', label: 'Line', icon: <Minus size={14} /> },
    { type: 'arrow', label: 'Arrow', icon: <ArrowRight size={14} /> },
    { type: 'polygon', label: 'Polygon', icon: <Hexagon size={14} /> },
    { type: 'star', label: 'Star', icon: <Star size={14} /> },
    { type: 'arc', label: 'Arc', icon: <PieChart size={14} /> },
    { type: 'ring', label: 'Ring', icon: <Disc size={14} /> },
    { type: 'wedge', label: 'Wedge', icon: <Pentagon size={14} /> },
    { type: 'callout', label: 'Callout', icon: <MessageSquare size={14} /> },
  ];

  const closeMenus = () => {
    setShowShapeMenu(false);
    setShowMarqueeMenu(false);
    setShowBrushMenu(false);
  };

  const handleToolClick = (toolId: ToolItem['id']) => {
    if (toolId === 'beforeAfter') {
      setBeforeAfterOpen(true);
      closeMenus();
      return;
    }
    if (toolId === 'marqueeMenu') {
      setShowMarqueeMenu((v) => !v);
      setShowShapeMenu(false);
      setShowBrushMenu(false);
      setActiveTool('marquee');
      return;
    }
    if (toolId === 'brushMenu') {
      setShowBrushMenu((v) => !v);
      setShowShapeMenu(false);
      setShowMarqueeMenu(false);
      setActiveTool('brush');
      return;
    }
    if (toolId === 'text') {
      addTextLayer();
      closeMenus();
      setActiveTool('text');
    } else if (toolId === 'shape') {
      setShowShapeMenu((v) => !v);
      setShowMarqueeMenu(false);
      setShowBrushMenu(false);
      setActiveTool('shape');
    } else {
      closeMenus();
      setActiveTool(toolId as ToolType);
    }
  };

  return (
    <>
      <aside className="shell-tools w-13 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2.5 z-40 select-none justify-between">
        <div className="flex flex-col items-center gap-0.5 w-full px-1.5 relative">
          {tools.map((tool) => {
            const isActive =
              tool.id === 'marqueeMenu'
                ? activeTool === 'marquee'
                : tool.id === 'brushMenu'
                  ? activeTool === 'brush'
                  : activeTool === tool.id;

            return (
              <React.Fragment key={tool.id}>
                {tool.separator && <div className="w-6 h-[1px] bg-[var(--border-subtle)] my-1" />}
                <div className="relative group w-full flex justify-center">
                  <button
                    onClick={() => handleToolClick(tool.id)}
                    title={`${tool.label} (${tool.shortcut})`}
                    className={`tool-btn w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer ${
                      isActive
                        ? 'tool-btn-active bg-[var(--accent)] text-[#1a1208]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {tool.icon}
                  </button>

                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded-[var(--radius-sm)] shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 flex items-center gap-2">
                    <span>{tool.label}</span>
                    <span className="text-[10px] font-mono-ui text-[var(--text-faint)] bg-[var(--bg-app)] px-1 rounded">
                      {tool.shortcut}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {showBrushMenu && (
            <div className="menu-flyout absolute left-full top-36 ml-2 w-56 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl p-2 z-50 flex flex-col gap-2">
              <div className="px-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider font-mono-ui">
                Brush color
              </div>
              <ColorField
                value={brushSettings.color}
                onChange={(hex) => updateBrushSettings({ color: hex })}
              />
              <div className="flex gap-1 flex-wrap px-0.5">
                {QUICK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => updateBrushSettings({ color: c })}
                    className="w-5 h-5 rounded border border-[var(--border-subtle)] cursor-pointer"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="px-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider font-mono-ui">
                Size
              </div>
              <div className="flex gap-1 flex-wrap">
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateBrushSettings({ size })}
                    className={`px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-mono-ui cursor-pointer border ${
                      brushSettings.size === size
                        ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                        : 'bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showMarqueeMenu && (
            <div className="menu-flyout absolute left-full top-12 ml-2 w-44 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider font-mono-ui">
                Marquee
              </div>
              <button
                onClick={() => {
                  setMarqueeMode('rect');
                  setActiveTool('marquee');
                  setShowMarqueeMenu(false);
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs text-left cursor-pointer ${
                  marqueeMode === 'rect'
                    ? 'bg-[var(--accent)] text-[#1a1208] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Square size={14} /> Rectangular
              </button>
              <button
                onClick={() => {
                  setMarqueeMode('ellipse');
                  setActiveTool('marquee');
                  setShowMarqueeMenu(false);
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs text-left cursor-pointer ${
                  marqueeMode === 'ellipse'
                    ? 'bg-[var(--accent)] text-[#1a1208] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Ellipse size={14} /> Elliptical
              </button>
            </div>
          )}

          {showShapeMenu && (
            <div className="menu-flyout absolute left-full top-64 ml-2 w-44 max-h-[70vh] overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider font-mono-ui">
                Shape
              </div>
              {shapes.map((s) => (
                <button
                  key={s.type}
                  onClick={() => {
                    setActiveShapeType(s.type);
                    addShapeLayer(s.type);
                    setShowShapeMenu(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs text-left cursor-pointer ${
                    activeShapeType === s.type
                      ? 'bg-[var(--accent)] text-[#1a1208] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 pb-2">
          {(activeTool === 'eyedropper' || activeTool === 'brush' || activeTool === 'fill') && (
            <div
              className="w-7 h-7 rounded-md border-2 border-[var(--accent)] shadow-lg"
              style={{ backgroundColor: brushSettings.color }}
              title="Active color"
            />
          )}

          <div className="relative w-10 h-10">
            <label
              title="Secondary Color"
              className="absolute bottom-0 right-0 w-6 h-6 rounded-md border-2 border-[var(--bg-panel)] shadow cursor-pointer overflow-hidden z-10 hover:scale-105 transition-transform"
              style={{ backgroundColor: secondaryColor }}
            >
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </label>
            <label
              title="Primary / Brush Color — click to pick"
              className="absolute top-0 left-0 w-6 h-6 rounded-md border-2 border-[var(--accent)] shadow cursor-pointer overflow-hidden z-20 hover:scale-105 transition-transform"
              style={{ backgroundColor: brushSettings.color }}
            >
              <input
                type="color"
                value={brushSettings.color}
                onChange={(e) => updateBrushSettings({ color: e.target.value })}
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>

          <div className="flex items-center gap-1 text-[var(--text-faint)]">
            <button
              onClick={swapBrushColors}
              title="Swap Colors (X)"
              className="p-1 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ArrowLeftRight size={11} />
            </button>
            <button
              onClick={resetBrushColors}
              title="Default Colors (D)"
              className="w-2.5 h-2.5 rounded-sm bg-[var(--border-strong)] hover:bg-[var(--accent)] cursor-pointer"
            />
          </div>
        </div>
      </aside>

      {isBeforeAfterOpen && <BeforeAfterSlider onClose={() => setBeforeAfterOpen(false)} />}
    </>
  );
};
