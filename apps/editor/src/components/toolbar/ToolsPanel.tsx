import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { ToolType, ShapeType } from '../../types/editor';
import { BeforeAfterSlider } from '../canvas/BeforeAfterSlider';

interface ToolItem {
  id: ToolType | 'beforeAfter' | 'marqueeMenu';
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  separator?: boolean;
}

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
  } = useEditorStore();

  const [secondaryColor, setSecondaryColor] = useState('#ece8e1');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showMarqueeMenu, setShowMarqueeMenu] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

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
      id: 'brush',
      label: 'Brush Tool',
      shortcut: 'B',
      icon: <Paintbrush size={18} />,
    },
    {
      id: 'eraser',
      label: 'Eraser Tool',
      shortcut: 'E',
      icon: <Eraser size={18} />,
    },
    {
      id: 'refineBrush',
      label: 'Edge Refinement Brush (Fix Cutouts)',
      shortcut: 'R',
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

  const handleToolClick = (toolId: ToolItem['id']) => {
    if (toolId === 'beforeAfter') {
      setShowBeforeAfter(true);
      setShowShapeMenu(false);
      setShowMarqueeMenu(false);
      return;
    }
    if (toolId === 'marqueeMenu') {
      setShowMarqueeMenu((v) => !v);
      setShowShapeMenu(false);
      setActiveTool('marquee');
      return;
    }
    if (toolId === 'text') {
      addTextLayer();
      setShowShapeMenu(false);
      setShowMarqueeMenu(false);
    } else if (toolId === 'shape') {
      setShowShapeMenu((v) => !v);
      setShowMarqueeMenu(false);
      setActiveTool('shape');
    } else {
      setShowShapeMenu(false);
      setShowMarqueeMenu(false);
      setActiveTool(toolId as ToolType);
    }
  };

  const swapColors = () => {
    const temp = brushSettings.color;
    updateBrushSettings({ color: secondaryColor });
    setSecondaryColor(temp);
  };

  const resetColors = () => {
    updateBrushSettings({ color: '#d4923a' });
    setSecondaryColor('#ece8e1');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const temp = brushSettings.color;
        updateBrushSettings({ color: secondaryColor });
        setSecondaryColor(temp);
      }
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        updateBrushSettings({ color: '#d4923a' });
        setSecondaryColor('#ece8e1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [brushSettings.color, secondaryColor, updateBrushSettings]);

  return (
    <>
      <aside className="w-13 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2.5 z-40 select-none justify-between">
        <div className="flex flex-col items-center gap-0.5 w-full px-1.5 relative">
          {tools.map((tool) => {
            const isActive =
              tool.id === 'marqueeMenu'
                ? activeTool === 'marquee'
                : activeTool === tool.id;

            return (
              <React.Fragment key={tool.id}>
                {tool.separator && <div className="w-6 h-[1px] bg-[var(--border-subtle)] my-1" />}
                <div className="relative group w-full flex justify-center">
                  <button
                    onClick={() => handleToolClick(tool.id)}
                    title={`${tool.label} (${tool.shortcut})`}
                    className={`w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent)] text-[#1a1208]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {tool.icon}
                  </button>

                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded-[var(--radius-sm)] shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 flex items-center gap-2">
                    <span>{tool.label}</span>
                    <span className="text-[10px] font-mono-ui text-[var(--text-faint)] bg-[var(--bg-app)] px-1 rounded">
                      {tool.shortcut}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {showMarqueeMenu && (
            <div className="absolute left-full top-12 ml-2 w-44 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl p-1 z-50 flex flex-col gap-0.5">
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
            <div className="absolute left-full top-64 ml-2 w-44 max-h-[70vh] overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl p-1 z-50 flex flex-col gap-0.5">
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
          {activeTool === 'eyedropper' && (
            <div
              className="w-6 h-6 rounded border-2 border-[var(--success)] shadow-lg"
              style={{ backgroundColor: brushSettings.color }}
              title="Sampled Color"
            />
          )}

          <div className="relative w-8 h-8">
            <label
              title="Secondary Color"
              className="absolute bottom-0 right-0 w-5 h-5 rounded-md border-2 border-[var(--bg-panel)] shadow cursor-pointer overflow-hidden z-10"
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
              title="Primary / Brush Color"
              className="absolute top-0 left-0 w-5 h-5 rounded-md border-2 border-[var(--bg-panel)] shadow cursor-pointer overflow-hidden z-20"
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
              onClick={swapColors}
              title="Swap Colors (X)"
              className="p-1 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ArrowLeftRight size={11} />
            </button>
            <button
              onClick={resetColors}
              title="Default Colors (D)"
              className="w-2.5 h-2.5 rounded-sm bg-[var(--border-strong)] hover:bg-[var(--accent)] cursor-pointer"
            />
          </div>
        </div>
      </aside>

      {showBeforeAfter && <BeforeAfterSlider onClose={() => setShowBeforeAfter(false)} />}
    </>
  );
};
