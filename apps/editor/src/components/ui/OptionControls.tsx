import React from 'react';
import { ColorField } from './ColorField';
import { DebouncedRange } from './DebouncedRange';

export const OptSep: React.FC = () => (
  <div className="h-3.5 w-px shrink-0 bg-[var(--border-subtle)]" />
);

export const OptLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="shrink-0 text-[var(--text-faint)]">{children}</span>
);

export const OptHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="shrink-0 text-[var(--text-faint)] italic">{children}</span>
);

interface SizeOptProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onCommit: (v: number) => void;
  widthClass?: string;
}

export const SizeOpt: React.FC<SizeOptProps> = ({
  label = 'Size',
  value,
  min = 1,
  max = 100,
  step = 1,
  unit = '',
  onCommit,
  widthClass = 'w-20',
}) => (
  <label className="flex items-center gap-1.5 shrink-0">
    <OptLabel>{label}</OptLabel>
    <DebouncedRange
      min={min}
      max={max}
      step={step}
      value={value}
      onCommit={onCommit}
      className={`${widthClass} cursor-pointer`}
    />
    <span className="font-mono-ui min-w-[2rem] text-[var(--text-primary)] tabular-nums">
      {step < 1 && step >= 0.01 ? Math.round(value * 100) : Math.round(value)}
      {step < 1 && step >= 0.01 ? '%' : unit}
    </span>
  </label>
);

interface NumOptProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onCommit: (v: number) => void;
  /** Input width class */
  widthClass?: string;
}

/** Compact numeric field for dense option bars (avoids wide range sliders). */
export const NumOpt: React.FC<NumOptProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onCommit,
  widthClass = 'w-11',
}) => (
  <label className="flex items-center gap-1 shrink-0" title={`${label}${unit ? ` (${unit})` : ''}`}>
    <OptLabel>{label}</OptLabel>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!Number.isFinite(next)) return;
        const clamped =
          min !== undefined && next < min ? min : max !== undefined && next > max ? max : next;
        onCommit(clamped);
      }}
      className={`${widthClass} bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-1 py-0.5 font-mono-ui text-[10px] text-[var(--text-primary)] tabular-nums outline-none focus:border-[var(--accent)]`}
    />
    {unit ? (
      <span className="text-[9px] font-mono-ui text-[var(--text-faint)]">{unit}</span>
    ) : null}
  </label>
);

interface ColorOptProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  allowNone?: boolean;
  onNone?: () => void;
  isNone?: boolean;
}

export const ColorOpt: React.FC<ColorOptProps> = ({
  label,
  value,
  onChange,
  allowNone,
  onNone,
  isNone,
}) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <ColorField
      size="sm"
      showPresets={false}
      label={label}
      value={isNone ? '#000000' : value === 'transparent' ? '#000000' : value}
      onChange={onChange}
    />
    {allowNone && (
      <button
        type="button"
        onClick={onNone}
        className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
          isNone
            ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
        }`}
      >
        None
      </button>
    )}
  </div>
);

interface ChipProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}

export const OptChip: React.FC<ChipProps> = ({ active, onClick, children, title }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] border cursor-pointer capitalize shrink-0 ${
      active
        ? 'bg-[var(--accent)] text-[#1a1208] border-transparent font-semibold'
        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`}
  >
    {children}
  </button>
);
