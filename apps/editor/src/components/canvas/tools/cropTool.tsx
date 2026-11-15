import React from 'react';
import { Rect, Line } from 'react-konva';
import { Check, X } from 'lucide-react';
import type { CropSettings } from '../../../types/editor';
import type { ToolHandler } from './types';

/** Crop is driven by draggable Konva handles in the UI layer, so the handler is pointer-less. */
export const cropTool: ToolHandler = {
  id: 'crop',
};

/** Darkened outside, clear hole + resize handles (rendered in the interactive `export-ui` layer). */
export const CropOverlay: React.FC<{
  cropSettings: CropSettings;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  setCropSettings: (patch: Partial<CropSettings>) => void;
}> = ({ cropSettings, zoom, canvasWidth, canvasHeight, setCropSettings }) => {
  const cx = cropSettings.x;
  const cy = cropSettings.y;
  const cw = cropSettings.width;
  const ch = cropSettings.height;
  const dim = 'rgba(8, 9, 12, 0.62)';
  const handleSize = Math.max(8, 10 / zoom);
  const minSize = 20;
  const aspect = cropSettings.aspect;

  const clampCrop = (next: { x: number; y: number; width: number; height: number }) => {
    let { x, y, width, height } = next;
    width = Math.max(minSize, Math.min(width, canvasWidth));
    height = Math.max(minSize, Math.min(height, canvasHeight));
    x = Math.max(0, Math.min(x, canvasWidth - width));
    y = Math.max(0, Math.min(y, canvasHeight - height));
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  const applyAspect = (
    width: number,
    height: number,
    anchor: 'width' | 'height'
  ) => {
    if (aspect === 'free') return { width, height };
    const ratios: Record<string, number> = {
      '1:1': 1,
      '16:9': 16 / 9,
      '4:3': 4 / 3,
      '9:16': 9 / 16,
      '3:2': 3 / 2,
      '2:3': 2 / 3,
    };
    const r = ratios[aspect] ?? 1;
    if (anchor === 'width') return { width, height: Math.max(minSize, width / r) };
    return { width: Math.max(minSize, height * r), height };
  };

  type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const handles: { id: Handle; x: number; y: number }[] = [
    { id: 'nw', x: cx, y: cy },
    { id: 'n', x: cx + cw / 2, y: cy },
    { id: 'ne', x: cx + cw, y: cy },
    { id: 'e', x: cx + cw, y: cy + ch / 2 },
    { id: 'se', x: cx + cw, y: cy + ch },
    { id: 's', x: cx + cw / 2, y: cy + ch },
    { id: 'sw', x: cx, y: cy + ch },
    { id: 'w', x: cx, y: cy + ch / 2 },
  ];

  const computeHandleCrop = (id: Handle, posX: number, posY: number) => {
    let x1 = cx;
    let y1 = cy;
    let x2 = cx + cw;
    let y2 = cy + ch;

    if (id.includes('w')) x1 = posX;
    if (id.includes('e')) x2 = posX;
    if (id.includes('n')) y1 = posY;
    if (id.includes('s')) y2 = posY;

    if (x2 - x1 < minSize) {
      if (id.includes('w')) x1 = x2 - minSize;
      else x2 = x1 + minSize;
    }
    if (y2 - y1 < minSize) {
      if (id.includes('n')) y1 = y2 - minSize;
      else y2 = y1 + minSize;
    }

    let width = x2 - x1;
    let height = y2 - y1;

    if (aspect !== 'free') {
      const fromWidth =
        id === 'e' || id === 'w' || id === 'ne' || id === 'se' || id === 'nw' || id === 'sw';
      const sized = applyAspect(width, height, fromWidth ? 'width' : 'height');
      width = sized.width;
      height = sized.height;
      if (id.includes('w')) x1 = x2 - width;
      else x2 = x1 + width;
      if (id.includes('n')) y1 = y2 - height;
      else y2 = y1 + height;
    }

    return clampCrop({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
  };

  const handlePos = (
    id: Handle,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    const map: Record<Handle, { x: number; y: number }> = {
      nw: { x: box.x, y: box.y },
      n: { x: box.x + box.width / 2, y: box.y },
      ne: { x: box.x + box.width, y: box.y },
      e: { x: box.x + box.width, y: box.y + box.height / 2 },
      se: { x: box.x + box.width, y: box.y + box.height },
      s: { x: box.x + box.width / 2, y: box.y + box.height },
      sw: { x: box.x, y: box.y + box.height },
      w: { x: box.x, y: box.y + box.height / 2 },
    };
    return map[id];
  };

  return (
    <>
      {/* Four panels so the crop area stays bright */}
      <Rect x={0} y={0} width={canvasWidth} height={Math.max(0, cy)} fill={dim} listening={false} />
      <Rect
        x={0}
        y={cy}
        width={Math.max(0, cx)}
        height={Math.max(0, ch)}
        fill={dim}
        listening={false}
      />
      <Rect
        x={cx + cw}
        y={cy}
        width={Math.max(0, canvasWidth - cx - cw)}
        height={Math.max(0, ch)}
        fill={dim}
        listening={false}
      />
      <Rect
        x={0}
        y={cy + ch}
        width={canvasWidth}
        height={Math.max(0, canvasHeight - cy - ch)}
        fill={dim}
        listening={false}
      />

      <Rect
        x={cx}
        y={cy}
        width={cw}
        height={ch}
        stroke="#d4923a"
        strokeWidth={2 / zoom}
        dash={[8 / zoom, 4 / zoom]}
        fill="transparent"
        draggable
        dragBoundFunc={(pos) => ({
          x: Math.max(0, Math.min(canvasWidth - cw, pos.x)),
          y: Math.max(0, Math.min(canvasHeight - ch, pos.y)),
        })}
        onDragMove={(e) => {
          const node = e.target;
          setCropSettings({
            x: Math.round(node.x()),
            y: Math.round(node.y()),
          });
        }}
      />

      {/* Rule-of-thirds guides */}
      <Line
        points={[cx + cw / 3, cy, cx + cw / 3, cy + ch]}
        stroke="rgba(236,232,225,0.35)"
        strokeWidth={1 / zoom}
        listening={false}
      />
      <Line
        points={[cx + (2 * cw) / 3, cy, cx + (2 * cw) / 3, cy + ch]}
        stroke="rgba(236,232,225,0.35)"
        strokeWidth={1 / zoom}
        listening={false}
      />
      <Line
        points={[cx, cy + ch / 3, cx + cw, cy + ch / 3]}
        stroke="rgba(236,232,225,0.35)"
        strokeWidth={1 / zoom}
        listening={false}
      />
      <Line
        points={[cx, cy + (2 * ch) / 3, cx + cw, cy + (2 * ch) / 3]}
        stroke="rgba(236,232,225,0.35)"
        strokeWidth={1 / zoom}
        listening={false}
      />

      {handles.map((h) => (
        <Rect
          key={h.id}
          x={h.x - handleSize / 2}
          y={h.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#ece8e1"
          stroke="#d4923a"
          strokeWidth={1.5 / zoom}
          cornerRadius={2 / zoom}
          draggable
          onDragMove={(e) => {
            const node = e.target;
            const next = computeHandleCrop(
              h.id,
              node.x() + handleSize / 2,
              node.y() + handleSize / 2
            );
            setCropSettings(next);
            const p = handlePos(h.id, next);
            node.position({
              x: p.x - handleSize / 2,
              y: p.y - handleSize / 2,
            });
          }}
        />
      ))}
    </>
  );
};

/** Floating Apply / Cancel bar shown while a crop is pending. */
export const CropControlBar: React.FC<{
  cropSettings: CropSettings;
  applyCrop: () => Promise<void>;
  cancelCrop: () => void;
}> = ({ cropSettings, applyCrop, cancelCrop }) => (
  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-40">
    <span className="text-xs text-zinc-300 font-medium">
      Crop: {cropSettings.width} × {cropSettings.height} px
    </span>
    <div className="h-4 w-[1px] bg-zinc-700" />
    <button
      onClick={() => void applyCrop()}
      className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)] hover:brightness-110 text-[#1a1208] rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
    >
      <Check size={14} /> Apply Crop
    </button>
    <button
      onClick={cancelCrop}
      className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-all cursor-pointer"
    >
      <X size={14} /> Cancel
    </button>
  </div>
);
