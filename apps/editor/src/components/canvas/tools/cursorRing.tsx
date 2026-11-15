import React from 'react';
import { Line } from 'react-konva';
import type { ToolContext } from './types';

const RING_TOOLS = new Set([
  'spotHealing',
  'clone',
  'brush',
  'eraser',
  'refineBrush',
  'blur',
  'fill',
  'dodge',
  'burn',
  'sharpenTool',
  'healing',
  'liquify',
  'quickSelect',
]);

/** Soft brush-size ring that follows the pointer for every brush-like tool. */
export function renderCursorRing(ctx: ToolContext): React.ReactNode {
  const { tool, session } = ctx;
  const cursorPos = session.cursorPos;
  if (!RING_TOOLS.has(tool) || !cursorPos) return null;

  const { brushSettings, toneBrushSettings } = ctx.getStore();
  const missingSource =
    (tool === 'clone' && !session.cloneSource) || (tool === 'healing' && !brushSettings.cloneSource);

  return (
    <Line
      points={[cursorPos.x, cursorPos.y]}
      stroke={
        missingSource
          ? '#e8a84a'
          : tool === 'spotHealing'
            ? '#e85d5d'
            : tool === 'healing'
              ? '#5ecf9a'
              : tool === 'quickSelect'
                ? '#5b8def'
                : '#d4923a'
      }
      strokeWidth={
        tool === 'dodge' || tool === 'burn' || tool === 'sharpenTool'
          ? toneBrushSettings.size
          : brushSettings.size
      }
      lineCap="round"
      opacity={0.18}
      shadowBlur={(1 - brushSettings.hardness) * brushSettings.size * 0.5}
      shadowColor={brushSettings.color}
      shadowOpacity={0.4}
      listening={false}
    />
  );
}
