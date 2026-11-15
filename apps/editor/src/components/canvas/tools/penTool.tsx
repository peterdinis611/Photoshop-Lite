import React from 'react';
import { Circle, Line, Path as KonvaPath } from 'react-konva';
import type { PathAnchor } from '../../../types/editor';
import { anchorsToSvgPath, dist } from '../../../utils/pathHelpers';
import type { ToolContext, ToolHandler } from './types';

function clearDraft(ctx: ToolContext) {
  ctx.session.penAnchors = [];
  ctx.session.penDragging = false;
  ctx.session.penCursor = null;
}

function commitPenPath(ctx: ToolContext, closed: boolean) {
  const { session } = ctx;
  if (session.penAnchors.length < 2) {
    session.penAnchors = [];
    session.penDragging = false;
    return;
  }
  ctx.getStore().addPathLayer(session.penAnchors, closed);
  clearDraft(ctx);
}

/** Click to place anchors, drag for smooth handles, click the first anchor to close. */
export const penTool: ToolHandler = {
  id: 'pen',

  onPointerDown: ({ point }, ctx) => {
    const { session } = ctx;
    const { penSettings } = ctx.getStore();
    if (
      session.penAnchors.length >= 2 &&
      dist(point.x, point.y, session.penAnchors[0].x, session.penAnchors[0].y) <=
        penSettings.closeThreshold
    ) {
      commitPenPath(ctx, true);
      return;
    }
    const next: PathAnchor = { x: point.x, y: point.y };
    session.penAnchors = [...session.penAnchors, next];
    session.penDragging = true;
  },

  onPointerMove: ({ point }, { session }) => {
    // Rubber-band + handle drag
    session.penCursor = point;
    if (session.penDragging && session.penAnchors.length > 0) {
      const idx = session.penAnchors.length - 1;
      const anchor = session.penAnchors[idx];
      const outX = point.x - anchor.x;
      const outY = point.y - anchor.y;
      session.penAnchors = session.penAnchors.map((a, i) =>
        i === idx
          ? { ...a, handleOutX: outX, handleOutY: outY, handleInX: -outX, handleInY: -outY }
          : a
      );
    }
  },

  onPointerUp: (_e, { session }) => {
    session.penDragging = false;
  },

  onKeyDown: (e, ctx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPenPath(ctx, false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearDraft(ctx);
    }
  },

  onDeactivate: (ctx) => clearDraft(ctx),

  renderOverlay: (ctx) => {
    const { session } = ctx;
    const anchors = session.penAnchors;
    if (anchors.length === 0) return null;
    const { zoom } = ctx.getView();
    const { penSettings } = ctx.getStore();
    const penCursor = session.penCursor;
    return (
      <>
        <KonvaPath
          data={anchorsToSvgPath(anchors, false)}
          stroke={penSettings.stroke}
          strokeWidth={penSettings.strokeWidth}
          fill={penSettings.fill !== 'transparent' ? penSettings.fill : undefined}
          opacity={0.9}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
        {penCursor && !session.penDragging && (
          <Line
            points={[anchors[anchors.length - 1].x, anchors[anchors.length - 1].y, penCursor.x, penCursor.y]}
            stroke={penSettings.stroke}
            strokeWidth={Math.max(1, penSettings.strokeWidth * 0.75)}
            dash={[6 / zoom, 4 / zoom]}
            opacity={0.55}
            listening={false}
          />
        )}
        {anchors.map((a, i) => (
          <React.Fragment key={`pen-a-${i}`}>
            {(a.handleOutX || a.handleOutY) && (
              <Line
                points={[a.x, a.y, a.x + (a.handleOutX ?? 0), a.y + (a.handleOutY ?? 0)]}
                stroke="#5b8def"
                strokeWidth={1 / zoom}
                listening={false}
              />
            )}
            <Circle
              x={a.x}
              y={a.y}
              radius={i === 0 ? 6 / zoom : 4 / zoom}
              fill={i === 0 ? '#d4923a' : '#ece8e1'}
              stroke="#1a1208"
              strokeWidth={1 / zoom}
              listening={false}
            />
          </React.Fragment>
        ))}
        {penCursor &&
          anchors.length >= 2 &&
          dist(penCursor.x, penCursor.y, anchors[0].x, anchors[0].y) <=
            penSettings.closeThreshold && (
            <Circle
              x={anchors[0].x}
              y={anchors[0].y}
              radius={10 / zoom}
              stroke="#5ecf9a"
              strokeWidth={2 / zoom}
              listening={false}
            />
          )}
      </>
    );
  },
};
