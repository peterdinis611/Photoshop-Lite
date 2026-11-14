import React, { useCallback, useMemo, useRef, useState } from 'react';
import { buildCurveLut } from '@photoshop-lite/editor-core';
import type { CurvePoint } from '../../types/editor';

const SIZE = 256;
const MIN_GAP = 4;

/** Five-point linear scaffold used when the stored curve has too few points to edit. */
const LINEAR_5: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 64, y: 64 },
  { x: 128, y: 128 },
  { x: 192, y: 192 },
  { x: 255, y: 255 },
];

const PRESETS: { id: string; label: string; points: CurvePoint[] }[] = [
  { id: 'linear', label: 'Linear', points: LINEAR_5 },
  {
    id: 'contrast',
    label: 'Contrast+',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 46 },
      { x: 128, y: 128 },
      { x: 192, y: 210 },
      { x: 255, y: 255 },
    ],
  },
  {
    id: 'fade',
    label: 'Fade',
    points: [
      { x: 0, y: 36 },
      { x: 64, y: 82 },
      { x: 128, y: 134 },
      { x: 192, y: 190 },
      { x: 255, y: 238 },
    ],
  },
];

interface CurvesEditorProps {
  /** Composite RGB curve points (0-255 each axis). */
  points: CurvePoint[] | undefined;
  onChange: (points: CurvePoint[]) => void;
}

export const CurvesEditor: React.FC<CurvesEditorProps> = ({ points, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ index: number; points: CurvePoint[] } | null>(null);

  const stored = useMemo(
    () => (points && points.length >= 3 ? points : LINEAR_5),
    [points]
  );
  const live = drag?.points ?? stored;

  const path = useMemo(() => {
    const lut = buildCurveLut(live);
    let d = '';
    for (let x = 0; x < 256; x++) d += `${x === 0 ? 'M' : 'L'}${x},${SIZE - lut[x]} `;
    return d;
  }, [live]);

  const toCurve = useCallback((e: React.PointerEvent): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = SIZE - ((e.clientY - rect.top) / rect.height) * SIZE;
    return {
      x: Math.round(Math.min(255, Math.max(0, x))),
      y: Math.round(Math.min(255, Math.max(0, y))),
    };
  }, []);

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ index, points: stored.map((p) => ({ ...p })) });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const { index } = drag;
    const next = drag.points.map((p) => ({ ...p }));
    const p = toCurve(e);
    const isEnd = index === 0 || index === next.length - 1;
    const lo = index === 0 ? 0 : next[index - 1].x + MIN_GAP;
    const hi = index === next.length - 1 ? 255 : next[index + 1].x - MIN_GAP;
    next[index] = {
      x: isEnd ? next[index].x : Math.min(hi, Math.max(lo, p.x)),
      y: p.y,
    };
    setDrag({ index, points: next });
  };

  const endDrag = () => {
    if (!drag) return;
    onChange(drag.points);
    setDrag(null);
  };

  const isIdentity = live.every((p) => Math.abs(p.x - p.y) < 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.points.map((p) => ({ ...p })))}
            className="px-2 py-1 rounded text-[10px] font-semibold cursor-pointer border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/60 hover:text-[var(--accent-hot)]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`-8 -8 ${SIZE + 16} ${SIZE + 16}`}
        className="w-full aspect-square rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label="RGB curve editor"
      >
        {/* quarter grid */}
        {[0, 64, 128, 192, 256].map((v) => (
          <g key={v} stroke="var(--border-subtle)" strokeWidth={v % 128 === 0 ? 1 : 0.5}>
            <line x1={v} y1={0} x2={v} y2={SIZE} />
            <line x1={0} y1={v} x2={SIZE} y2={v} />
          </g>
        ))}
        {/* identity diagonal */}
        <line
          x1={0}
          y1={SIZE}
          x2={SIZE}
          y2={0}
          stroke="var(--text-faint)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        {/* curve */}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--accent-glow))' }}
        />
        {/* handles */}
        {live.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={SIZE - p.y}
            r={drag?.index === i ? 7 : 5.5}
            fill={drag?.index === i ? 'var(--accent-hot)' : 'var(--bg-panel)'}
            stroke="var(--accent-hot)"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown(i)}
          />
        ))}
      </svg>

      <div className="flex items-center justify-between font-mono-ui text-[10px] text-[var(--text-faint)]">
        <span>
          {drag
            ? `In ${drag.points[drag.index].x} → Out ${drag.points[drag.index].y}`
            : 'Drag points to shape RGB'}
        </span>
        {!isIdentity && (
          <button
            type="button"
            onClick={() => onChange(LINEAR_5.map((p) => ({ ...p })))}
            className="text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
