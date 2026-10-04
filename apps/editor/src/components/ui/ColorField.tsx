import React from 'react';

const PRESETS = [
  '#d4923a',
  '#ece8e1',
  '#0b0c0f',
  '#e85d5d',
  '#5ecf9a',
  '#5b8def',
  '#e8a84a',
  '#c084fc',
  '#f472b6',
  '#22d3ee',
  '#ffffff',
  '#6b7280',
];

interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  showPresets?: boolean;
  size?: 'sm' | 'md';
}

export const ColorField: React.FC<ColorFieldProps> = ({
  value,
  onChange,
  label,
  showPresets = true,
  size = 'md',
}) => {
  const swatch = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-[var(--text-faint)] shrink-0">{label}</span>}
      <label
        className={`relative ${swatch} rounded-[var(--radius-sm)] border-2 border-[var(--border-strong)] shadow-inner cursor-pointer overflow-hidden shrink-0 ring-offset-1 hover:ring-1 hover:ring-[var(--accent)]`}
        style={{ backgroundColor: value }}
        title="Pick color"
      >
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (/^#?[0-9a-fA-F]{0,8}$/.test(next)) {
            onChange(next.startsWith('#') ? next : `#${next}`);
          }
        }}
        spellCheck={false}
        className="w-[4.5rem] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono-ui text-[10px] text-[var(--text-primary)] uppercase outline-none focus:border-[var(--accent)]"
      />
      {showPresets && (
        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              className={`w-3.5 h-3.5 rounded-sm border cursor-pointer transition-transform hover:scale-125 ${
                value.toLowerCase() === c.toLowerCase()
                  ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                  : 'border-[var(--border-subtle)]'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function normalizeHex(value: string): string {
  const h = value.startsWith('#') ? value : `#${value}`;
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return '#d4923a';
}
