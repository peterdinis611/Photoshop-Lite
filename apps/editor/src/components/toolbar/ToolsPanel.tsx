import React, { useMemo, useState } from 'react';
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
} from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { ToolType, ShapeType } from '../../types/editor';
import { BeforeAfterSlider } from '../canvas/BeforeAfterSlider';
import { ColorField } from '../ui/ColorField';
import { AnimatedMenu, MenuLabel } from '../ui/AnimatedMenu';

type ToolId =
  | ToolType
  | 'beforeAfter'
  | 'marqueeMenu'
  | 'brushMenu'
  | 'lassoMenu'
  | 'healMenu'
  | 'wandMenu';

interface ToolItem {
  id: ToolId;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
}

interface ToolGroup {
  id: string;
  label: string;
  tools: ToolItem[];
}

const BRUSH_SIZES = [4, 12, 24, 48, 80];
const QUICK_COLORS = ['#d4923a', '#ece8e1', '#0b0c0f', '#e85d5d', '#5ecf9a', '#5b8def', '#ffffff'];

const LASSO_TOOLS: ToolType[] = ['lasso', 'polyLasso', 'magneticLasso'];
const HEAL_TOOLS: ToolType[] = ['spotHealing', 'healing', 'patch'];
const WAND_TOOLS: ToolType[] = ['wand', 'quickSelect'];

function FlyoutChevron() {
  return <ChevronRight size={9} className="absolute -right-0.5 -bottom-0.5 opacity-55" aria-hidden />;
}

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
  const [showLassoMenu, setShowLassoMenu] = useState(false);
  const [showHealMenu, setShowHealMenu] = useState(false);
  const [showWandMenu, setShowWandMenu] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [hoverTip, setHoverTip] = useState<{
    label: string;
    shortcut?: string;
    top: number;
    left: number;
  } | null>(null);

  const groups: ToolGroup[] = useMemo(
    () => [
      {
        id: 'select',
        label: 'Select',
        tools: [
          {
            id: 'select',
            label: 'Move / Selection',
            shortcut: 'V',
            icon: <MousePointer size={17} />,
          },
          {
            id: 'marqueeMenu',
            label: 'Marquee Tools',
            shortcut: 'M',
            icon: (
              <span className="relative inline-flex">
                {marqueeMode === 'ellipse' ? <Ellipse size={17} /> : <Square size={17} />}
                <FlyoutChevron />
              </span>
            ),
          },
          {
            id: 'lassoMenu',
            label: 'Lasso Tools',
            shortcut: 'L',
            icon: (
              <span className="relative inline-flex">
                {activeTool === 'polyLasso' ? (
                  <Hexagon size={17} />
                ) : activeTool === 'magneticLasso' ? (
                  <Magnet size={17} />
                ) : (
                  <Lasso size={17} />
                )}
                <FlyoutChevron />
              </span>
            ),
          },
          {
            id: 'wandMenu',
            label: 'Wand Tools',
            shortcut: 'W',
            icon: (
              <span className="relative inline-flex">
                {activeTool === 'quickSelect' ? <Sparkle size={17} /> : <WandSparkles size={17} />}
                <FlyoutChevron />
              </span>
            ),
          },
        ],
      },
      {
        id: 'crop',
        label: 'Crop',
        tools: [
          {
            id: 'crop',
            label: 'Crop & Rotate',
            shortcut: 'C',
            icon: <Crop size={17} />,
          },
        ],
      },
      {
        id: 'paint',
        label: 'Paint',
        tools: [
          {
            id: 'brushMenu',
            label: 'Brush — color & size',
            shortcut: 'B',
            icon: (
              <span className="relative inline-flex">
                <Paintbrush size={17} />
                <FlyoutChevron />
              </span>
            ),
          },
          {
            id: 'eraser',
            label: 'Eraser',
            shortcut: 'E',
            icon: <Eraser size={17} />,
          },
          {
            id: 'fill',
            label: 'Paint Bucket',
            shortcut: 'G',
            icon: <PaintBucket size={17} />,
          },
          {
            id: 'gradient',
            label: 'Gradient',
            shortcut: 'Shift+G',
            icon: <Blend size={17} />,
          },
        ],
      },
      {
        id: 'tone',
        label: 'Tone',
        tools: [
          {
            id: 'blur',
            label: 'Blur',
            shortcut: 'R',
            icon: <Droplets size={17} />,
          },
          {
            id: 'sharpenTool',
            label: 'Sharpen',
            shortcut: 'Shift+S',
            icon: <Aperture size={17} />,
          },
          {
            id: 'dodge',
            label: 'Dodge — lighten',
            shortcut: 'O',
            icon: <SunMedium size={17} />,
          },
          {
            id: 'burn',
            label: 'Burn — darken',
            shortcut: 'Shift+O',
            icon: <Moon size={17} />,
          },
          {
            id: 'refineBrush',
            label: 'Edge Refinement',
            shortcut: 'Shift+R',
            icon: <Sparkles size={17} />,
          },
        ],
      },
      {
        id: 'retouch',
        label: 'Retouch',
        tools: [
          {
            id: 'healMenu',
            label: 'Healing Tools',
            shortcut: 'J',
            icon: (
              <span className="relative inline-flex">
                {activeTool === 'patch' ? <BoxSelect size={17} /> : <Bandage size={17} />}
                <FlyoutChevron />
              </span>
            ),
          },
          {
            id: 'clone',
            label: 'Clone Stamp',
            shortcut: 'S',
            icon: <Stamp size={17} />,
          },
        ],
      },
      {
        id: 'draw',
        label: 'Draw',
        tools: [
          {
            id: 'eyedropper',
            label: 'Eyedropper',
            shortcut: 'I',
            icon: <Pipette size={17} />,
          },
          {
            id: 'text',
            label: 'Type',
            shortcut: 'T',
            icon: <Type size={17} />,
          },
          {
            id: 'pen',
            label: 'Pen',
            shortcut: 'P',
            icon: <PenTool size={17} />,
          },
          {
            id: 'shape',
            label: 'Shape',
            shortcut: 'U',
            icon: (
              <span className="relative inline-flex">
                {activeShapeType === 'circle' || activeShapeType === 'ellipse' ? (
                  <Circle size={17} />
                ) : activeShapeType === 'arrow' ? (
                  <ArrowRight size={17} />
                ) : activeShapeType === 'star' ? (
                  <Star size={17} />
                ) : activeShapeType === 'callout' ? (
                  <MessageSquare size={17} />
                ) : (
                  <Square size={17} />
                )}
                <FlyoutChevron />
              </span>
            ),
          },
        ],
      },
      {
        id: 'view',
        label: 'View',
        tools: [
          {
            id: 'liquify',
            label: 'Liquify',
            shortcut: 'Shift+X',
            icon: <Waves size={17} />,
          },
          {
            id: 'transform',
            label: 'Transform',
            shortcut: 'Shift+T',
            icon: <Move3d size={17} />,
          },
          {
            id: 'beforeAfter',
            label: 'Before / After',
            shortcut: '\\',
            icon: <GitCompare size={17} />,
          },
        ],
      },
    ],
    [activeShapeType, activeTool, marqueeMode]
  );

  /** Always pinned — Hand / Zoom stay reachable without scrolling the rail. */
  const viewDock: { id: ToolId; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'hand', label: 'Hand (Pan)', shortcut: 'H', icon: <Hand size={17} /> },
    { id: 'zoom', label: 'Zoom', shortcut: 'Z', icon: <Search size={17} /> },
  ];

  // Flyouts: 36px button; ~13px group divider
  const flyoutTop = (id: ToolId) => {
    let top = 0;
    for (const group of groups) {
      top += 13; // group head
      for (const t of group.tools) {
        if (t.id === id) return top - scrollTop;
        top += 38;
      }
    }
    return 0;
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
    setShowLassoMenu(false);
    setShowHealMenu(false);
    setShowWandMenu(false);
  };

  const isToolActive = (id: ToolId) => {
    if (id === 'marqueeMenu') return activeTool === 'marquee';
    if (id === 'brushMenu') return activeTool === 'brush';
    if (id === 'lassoMenu') return LASSO_TOOLS.includes(activeTool);
    if (id === 'healMenu') return HEAL_TOOLS.includes(activeTool);
    if (id === 'wandMenu') return WAND_TOOLS.includes(activeTool);
    return activeTool === id;
  };

  const handleToolClick = (toolId: ToolId) => {
    if (toolId === 'beforeAfter') {
      setBeforeAfterOpen(true);
      closeMenus();
      return;
    }
    if (toolId === 'marqueeMenu') {
      setShowMarqueeMenu((v) => !v);
      setShowShapeMenu(false);
      setShowBrushMenu(false);
      setShowLassoMenu(false);
      setShowHealMenu(false);
      setShowWandMenu(false);
      setActiveTool('marquee');
      return;
    }
    if (toolId === 'lassoMenu') {
      setShowLassoMenu((v) => !v);
      setShowMarqueeMenu(false);
      setShowShapeMenu(false);
      setShowBrushMenu(false);
      setShowHealMenu(false);
      setShowWandMenu(false);
      if (!LASSO_TOOLS.includes(activeTool)) setActiveTool('lasso');
      return;
    }
    if (toolId === 'healMenu') {
      setShowHealMenu((v) => !v);
      setShowMarqueeMenu(false);
      setShowShapeMenu(false);
      setShowBrushMenu(false);
      setShowLassoMenu(false);
      setShowWandMenu(false);
      if (!HEAL_TOOLS.includes(activeTool)) setActiveTool('spotHealing');
      return;
    }
    if (toolId === 'wandMenu') {
      setShowWandMenu((v) => !v);
      setShowMarqueeMenu(false);
      setShowShapeMenu(false);
      setShowBrushMenu(false);
      setShowLassoMenu(false);
      setShowHealMenu(false);
      if (!WAND_TOOLS.includes(activeTool)) setActiveTool('wand');
      return;
    }
    if (toolId === 'brushMenu') {
      setShowBrushMenu((v) => !v);
      setShowShapeMenu(false);
      setShowMarqueeMenu(false);
      setShowLassoMenu(false);
      setShowHealMenu(false);
      setShowWandMenu(false);
      setActiveTool('brush');
      return;
    }
    if (toolId === 'shape') {
      setShowShapeMenu((v) => !v);
      setShowMarqueeMenu(false);
      setShowBrushMenu(false);
      setShowLassoMenu(false);
      setShowHealMenu(false);
      setShowWandMenu(false);
      setActiveTool('shape');
      return;
    }
    closeMenus();
    setActiveTool(toolId as ToolType);
  };

  return (
    <>
      <aside
        className="shell-tools tools-rail w-13 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2 z-40 select-none justify-between"
        data-tour="tour-tools"
        aria-label="Tools"
      >
        <div className="relative flex-1 min-h-0 w-full">
          <div
            onScroll={(e) => {
              setScrollTop(e.currentTarget.scrollTop);
              setHoverTip(null);
            }}
            className="tools-scroll h-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-0 w-full px-1.5 pb-2"
          >
            {groups.map((group) => (
              <div key={group.id} className="tools-group w-full flex flex-col items-center">
                <div className="tools-group__rule" title={group.label} aria-hidden>
                  <span className="tools-group__tick" />
                </div>
                <span className="sr-only">{group.label}</span>
                {group.tools.map((tool) => {
                  const isActive = isToolActive(tool.id);
                  return (
                    <div
                      key={tool.id}
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
                        aria-label={
                          tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label
                        }
                        aria-pressed={isActive}
                        className={`tool-btn w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer ${
                          isActive
                            ? 'tool-btn-active'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {tool.icon}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
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
            open={showLassoMenu}
            onClose={() => setShowLassoMenu(false)}
            origin="left"
            widthClass="w-52"
            className="left-full ml-2"
            style={{ top: flyoutTop('lassoMenu') }}
            closeOnLeave={false}
          >
            <MenuLabel>Lasso</MenuLabel>
            {(
              [
                { id: 'lasso' as const, label: 'Freehand Lasso', icon: <Lasso size={14} />, shortcut: 'L' },
                {
                  id: 'polyLasso' as const,
                  label: 'Polygonal',
                  icon: <Hexagon size={14} />,
                  shortcut: 'Shift+L',
                },
                {
                  id: 'magneticLasso' as const,
                  label: 'Magnetic',
                  icon: <Magnet size={14} />,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTool(item.id);
                  setShowLassoMenu(false);
                }}
                className={`menu-item ${activeTool === item.id ? 'menu-item--active' : ''}`}
              >
                <span className="menu-item-label">
                  {item.icon} {item.label}
                </span>
                {'shortcut' in item && item.shortcut ? (
                  <span className="menu-item-hint">{item.shortcut}</span>
                ) : null}
              </button>
            ))}
          </AnimatedMenu>

          <AnimatedMenu
            open={showWandMenu}
            onClose={() => setShowWandMenu(false)}
            origin="left"
            widthClass="w-52"
            className="left-full ml-2"
            style={{ top: flyoutTop('wandMenu') }}
            closeOnLeave={false}
          >
            <MenuLabel>Select</MenuLabel>
            <button
              type="button"
              onClick={() => {
                setActiveTool('wand');
                setShowWandMenu(false);
              }}
              className={`menu-item ${activeTool === 'wand' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <WandSparkles size={14} /> Magic Wand
              </span>
              <span className="menu-item-hint">W</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('quickSelect');
                setShowWandMenu(false);
              }}
              className={`menu-item ${activeTool === 'quickSelect' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <Sparkle size={14} /> Quick Select
              </span>
              <span className="menu-item-hint">Shift+W</span>
            </button>
          </AnimatedMenu>

          <AnimatedMenu
            open={showHealMenu}
            onClose={() => setShowHealMenu(false)}
            origin="left"
            widthClass="w-56"
            className="left-full ml-2"
            style={{ top: flyoutTop('healMenu') }}
            closeOnLeave={false}
          >
            <MenuLabel>Healing</MenuLabel>
            <button
              type="button"
              onClick={() => {
                setActiveTool('spotHealing');
                setShowHealMenu(false);
              }}
              className={`menu-item ${activeTool === 'spotHealing' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <Bandage size={14} /> Spot Healing
              </span>
              <span className="menu-item-hint">J</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('healing');
                setShowHealMenu(false);
              }}
              className={`menu-item ${activeTool === 'healing' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <Bandage size={14} /> Healing Brush
              </span>
              <span className="menu-item-hint">Shift+J</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('patch');
                setShowHealMenu(false);
              }}
              className={`menu-item ${activeTool === 'patch' ? 'menu-item--active' : ''}`}
            >
              <span className="menu-item-label">
                <BoxSelect size={14} /> Patch
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

        <div className="tools-view-dock flex flex-col items-center gap-0.5 w-full px-1.5 pt-1.5 border-t border-[var(--border-subtle)]">
          {viewDock.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={`${tool.label} (${tool.shortcut})`}
                aria-label={`${tool.label} (${tool.shortcut})`}
                aria-pressed={isActive}
                onClick={() => handleToolClick(tool.id)}
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
                className={`tool-btn w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer ${
                  isActive
                    ? 'tool-btn-active'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {tool.icon}
              </button>
            );
          })}
        </div>

        <div className="tools-colors flex flex-col items-center gap-2 pb-2 pt-1 border-t border-[var(--border-subtle)] w-full">
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
              type="button"
              onClick={swapBrushColors}
              title="Swap Colors (X)"
              className="p-1 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ArrowLeftRight size={11} />
            </button>
            <button
              type="button"
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
