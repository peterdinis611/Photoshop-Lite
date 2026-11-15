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
  PenTool,
  Blend,
  SunMedium,
  Moon,
  Aperture,
  Magnet,
  Sparkle,
  BoxSelect,
  Waves,
  Move3d,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { ToolType, ShapeType } from '../../types/editor';
import { BeforeAfterSlider } from '../canvas/BeforeAfterSlider';
import { ColorField } from '../ui/ColorField';
import { AnimatedMenu, MenuLabel } from '../ui/AnimatedMenu';

interface ToolItem {
  id: ToolType | 'beforeAfter' | 'marqueeMenu' | 'brushMenu';
  label: string;
  shortcut?: string;
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
  const [scrollTop, setScrollTop] = useState(0);
  const [hoverTip, setHoverTip] = useState<{
    label: string;
    shortcut?: string;
    top: number;
    left: number;
  } | null>(null);

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
      id: 'polyLasso',
      label: 'Polygonal Lasso — click points, double-click to close',
      shortcut: 'Shift+L',
      icon: <Hexagon size={18} className="text-sky-300" />,
    },
    {
      id: 'magneticLasso',
      label: 'Magnetic Lasso — snaps to edges',
      icon: <Magnet size={18} className="text-sky-300" />,
    },
    {
      id: 'quickSelect',
      label: 'Quick Selection — paint to select',
      shortcut: 'Shift+W',
      icon: <Sparkle size={18} className="text-violet-300" />,
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
      id: 'gradient',
      label: 'Gradient Tool — drag to fill',
      shortcut: 'Shift+G',
      icon: <Blend size={18} className="text-sky-300" />,
    },
    {
      id: 'blur',
      label: 'Blur Tool',
      shortcut: 'R',
      icon: <Droplets size={18} className="text-cyan-300" />,
    },
    {
      id: 'sharpenTool',
      label: 'Sharpen Tool — paint to add detail',
      shortcut: 'Shift+S',
      icon: <Aperture size={18} className="text-cyan-300" />,
    },
    {
      id: 'dodge',
      label: 'Dodge Tool — lighten areas',
      shortcut: 'O',
      icon: <SunMedium size={18} className="text-amber-300" />,
    },
    {
      id: 'burn',
      label: 'Burn Tool — darken areas',
      shortcut: 'Shift+O',
      icon: <Moon size={18} className="text-amber-500" />,
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
      id: 'healing',
      label: 'Healing Brush — Alt+Click to set source',
      shortcut: 'Shift+J',
      icon: <Bandage size={18} className="text-orange-300" />,
    },
    {
      id: 'patch',
      label: 'Patch Tool — select area, drag to source',
      icon: <BoxSelect size={18} className="text-orange-300" />,
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
      id: 'pen',
      label: 'Pen Tool — click for corners, drag for curves',
      shortcut: 'P',
      icon: <PenTool size={18} className="text-[var(--accent-hot)]" />,
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
      id: 'liquify',
      label: 'Liquify — push pixels',
      shortcut: 'Shift+X',
      icon: <Waves size={18} className="text-teal-300" />,
      separator: true,
    },
    {
      id: 'transform',
      label: 'Transform — free, skew, distort, perspective, warp',
      shortcut: 'Shift+T',
      icon: <Move3d size={18} className="text-teal-300" />,
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

  // Flyouts anchor to their tool button: 36px button + 2px gap per row, 9px per separator.
  const flyoutTop = (id: ToolItem['id']) => {
    let top = 0;
    for (const t of tools) {
      if (t.separator) top += 9;
      if (t.id === id) return top;
      top += 38;
    }
    return top - scrollTop;
  };

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
      <aside
        className="shell-tools w-13 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2.5 z-40 select-none justify-between"
        data-tour="tour-tools"
        aria-label="Tools"
      >
        <div className="relative flex-1 min-h-0 w-full">
        <div
          onScroll={(e) => {
            setScrollTop(e.currentTarget.scrollTop);
            setHoverTip(null);
          }}
          className="tools-scroll h-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-0.5 w-full px-1.5 pb-2"
        >
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
                <div
                  className="relative group w-full flex justify-center"
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setHoverTip({
                      label: tool.label,
                      shortcut: tool.shortcut,
                      top: r.top + r.height / 2,
                      left: r.right + 8,
                    });
                  }}
                  onMouseLeave={() => setHoverTip(null)}
                >
                  <button
                    type="button"
                    onClick={() => handleToolClick(tool.id)}
                    aria-label={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                    aria-pressed={isActive}
                    className={`tool-btn w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer ${
                      isActive
                        ? 'tool-btn-active bg-[var(--accent)] text-[#1a1208]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {tool.icon}
                  </button>

                </div>
              </React.Fragment>
            );
          })}
        </div>

          <AnimatedMenu
            open={showBrushMenu}
            onClose={() => setShowBrushMenu(false)}
            origin="left"
            widthClass="w-56"
            className="left-full ml-2 !py-2 px-2 flex flex-col gap-2"
            style={{ top: flyoutTop('brushMenu') }}
            closeOnLeave={false}
          >
            <MenuLabel>Brush color</MenuLabel>
            <div className="px-1 relative z-[1]">
              <ColorField
                value={brushSettings.color}
                onChange={(hex) => updateBrushSettings({ color: hex })}
              />
            </div>
            <div className="flex gap-1 flex-wrap px-1 relative z-[1]">
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
            <MenuLabel>Size</MenuLabel>
            <div className="flex gap-1 flex-wrap px-1 relative z-[1]">
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
          </AnimatedMenu>

          <AnimatedMenu
            open={showMarqueeMenu}
            onClose={() => setShowMarqueeMenu(false)}
            origin="left"
            widthClass="w-44"
            className="left-full ml-2"
            style={{ top: flyoutTop('marqueeMenu') }}
            closeOnLeave={false}
          >
            <MenuLabel>Marquee</MenuLabel>
            <button
              type="button"
              onClick={() => {
                setMarqueeMode('rect');
                setActiveTool('marquee');
                setShowMarqueeMenu(false);
              }}
              className={`menu-item ${marqueeMode === 'rect' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <Square size={14} /> Rectangular
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMarqueeMode('ellipse');
                setActiveTool('marquee');
                setShowMarqueeMenu(false);
              }}
              className={`menu-item ${marqueeMode === 'ellipse' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <Ellipse size={14} /> Elliptical
              </span>
            </button>
          </AnimatedMenu>

          <AnimatedMenu
            open={showShapeMenu}
            onClose={() => setShowShapeMenu(false)}
            origin="left"
            widthClass="w-44 max-h-[70vh] overflow-y-auto"
            className="left-full ml-2"
            style={{ top: flyoutTop('shape') }}
            closeOnLeave={false}
          >
            <MenuLabel>Shape</MenuLabel>
            {shapes.map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => {
                  setActiveShapeType(s.type);
                  setActiveTool('shape');
                  setShowShapeMenu(false);
                }}
                className={`menu-item ${activeShapeType === s.type ? 'menu-item--active' : ''}`}
              >
                <span className="menu-item-label">
                  {s.icon}
                  <span>{s.label}</span>
                </span>
              </button>
            ))}
          </AnimatedMenu>
        </div>

        <div className="flex flex-col items-center gap-2 pb-2">
          {(activeTool === 'eyedropper' ||
            activeTool === 'brush' ||
            activeTool === 'fill' ||
            activeTool === 'gradient') && (
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

      {hoverTip && (
        <div
          className="fixed z-[300] -translate-y-1/2 px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded-[var(--radius-sm)] shadow-xl whitespace-nowrap pointer-events-none flex items-center gap-2"
          style={{ top: hoverTip.top, left: hoverTip.left }}
        >
          <span>{hoverTip.label}</span>
          {hoverTip.shortcut && (
            <span className="text-[10px] font-mono-ui text-[var(--text-faint)] bg-[var(--bg-app)] px-1 rounded">
              {hoverTip.shortcut}
            </span>
          )}
        </div>
      )}

      {isBeforeAfterOpen && <BeforeAfterSlider onClose={() => setBeforeAfterOpen(false)} />}
    </>
  );
};
