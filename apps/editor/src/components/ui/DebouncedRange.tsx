import React, { useEffect, useState } from 'react';
import { useDebouncedCallback } from '@tanstack/react-pacer';

interface DebouncedRangeProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  wait?: number;
  className?: string;
  onCommit: (value: number) => void;
  title?: string;
}

/**
 * Responsive range input that commits via TanStack Pacer debounce.
 */
export const DebouncedRange: React.FC<DebouncedRangeProps> = ({
  value,
  min,
  max,
  step = 1,
  wait = 80,
  className = 'w-20 cursor-pointer',
  onCommit,
  title,
}) => {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = useDebouncedCallback(
    (next: number) => {
      onCommit(next);
    },
    { wait }
  );

  return (
    <input
      type="range"
      title={title}
      min={min}
      max={max}
      step={step}
      value={local}
      onChange={(e) => {
        const next = Number(e.target.value);
        setLocal(next);
        commit(next);
      }}
      onMouseUp={() => commit(local)}
      onTouchEnd={() => commit(local)}
      className={className}
    />
  );
};
