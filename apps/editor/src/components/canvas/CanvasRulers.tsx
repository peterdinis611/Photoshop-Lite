import React, { useEffect, useRef } from 'react';

interface CanvasRulersProps {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  pan: { x: number; y: number };
  cursorPos: { x: number; y: number } | null;
}

export const CanvasRulers: React.FC<CanvasRulersProps> = ({
  zoom,
  pan,
  cursorPos,
}) => {
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const leftCanvas = leftCanvasRef.current;
    if (!topCanvas || !leftCanvas) return;

    const topCtx = topCanvas.getContext('2d');
    const leftCtx = leftCanvas.getContext('2d');
    if (!topCtx || !leftCtx) return;

    const dpr = window.devicePixelRatio || 1;

    // Top Ruler
    const topW = topCanvas.parentElement?.clientWidth || 800;
    topCanvas.width = topW * dpr;
    topCanvas.height = 24 * dpr;
    topCanvas.style.width = `${topW}px`;
    topCanvas.style.height = `24px`;
    topCtx.scale(dpr, dpr);

    topCtx.fillStyle = '#18191d';
    topCtx.fillRect(0, 0, topW, 24);
    topCtx.fillStyle = '#6b7280';
    topCtx.strokeStyle = '#374151';
    topCtx.font = '9px -apple-system, sans-serif';

    // Step size based on zoom
    let step = 50;
    if (zoom > 2) step = 10;
    else if (zoom < 0.4) step = 200;
    else if (zoom < 0.7) step = 100;

    const startX = -pan.x / zoom;
    const endX = (topW - pan.x) / zoom;
    const firstTick = Math.floor(startX / step) * step;

    for (let x = firstTick; x <= endX; x += step) {
      const screenX = x * zoom + pan.x;
      if (screenX < 24 || screenX > topW) continue;

      const isMajor = x % (step * 2) === 0;
      const tickH = isMajor ? 12 : 6;

      topCtx.beginPath();
      topCtx.moveTo(screenX, 24 - tickH);
      topCtx.lineTo(screenX, 24);
      topCtx.stroke();

      if (isMajor) {
        topCtx.fillText(`${x}`, screenX + 2, 12);
      }
    }

    // Cursor indicator on top ruler
    if (cursorPos) {
      const curX = cursorPos.x * zoom + pan.x;
      topCtx.fillStyle = '#3b82f6';
      topCtx.fillRect(curX - 1, 0, 2, 24);
    }

    // Left Ruler
    const leftH = leftCanvas.parentElement?.clientHeight || 600;
    leftCanvas.width = 24 * dpr;
    leftCanvas.height = leftH * dpr;
    leftCanvas.style.width = `24px`;
    leftCanvas.style.height = `${leftH}px`;
    leftCtx.scale(dpr, dpr);

    leftCtx.fillStyle = '#18191d';
    leftCtx.fillRect(0, 0, 24, leftH);
    leftCtx.fillStyle = '#6b7280';
    leftCtx.strokeStyle = '#374151';
    leftCtx.font = '9px -apple-system, sans-serif';

    const startY = -pan.y / zoom;
    const endY = (leftH - pan.y) / zoom;
    const firstTickY = Math.floor(startY / step) * step;

    for (let y = firstTickY; y <= endY; y += step) {
      const screenY = y * zoom + pan.y;
      if (screenY < 24 || screenY > leftH) continue;

      const isMajor = y % (step * 2) === 0;
      const tickW = isMajor ? 12 : 6;

      leftCtx.beginPath();
      leftCtx.moveTo(24 - tickW, screenY);
      leftCtx.lineTo(24, screenY);
      leftCtx.stroke();

      if (isMajor) {
        leftCtx.save();
        leftCtx.translate(10, screenY - 2);
        leftCtx.rotate(-Math.PI / 2);
        leftCtx.fillText(`${y}`, 0, 0);
        leftCtx.restore();
      }
    }

    // Cursor indicator on left ruler
    if (cursorPos) {
      const curY = cursorPos.y * zoom + pan.y;
      leftCtx.fillStyle = '#3b82f6';
      leftCtx.fillRect(0, curY - 1, 24, 2);
    }
  }, [zoom, pan, cursorPos]);

  return (
    <>
      {/* Top Left Corner */}
      <div className="absolute top-0 left-0 w-6 h-6 bg-[#18191d] border-r border-b border-[#2c2f38] z-30 flex items-center justify-center text-[9px] font-mono text-zinc-500 select-none">
        px
      </div>

      {/* Top Ruler */}
      <div className="absolute top-0 left-6 right-0 h-6 overflow-hidden border-b border-[#2c2f38] z-20 pointer-events-none">
        <canvas ref={topCanvasRef} className="w-full h-full block" />
      </div>

      {/* Left Ruler */}
      <div className="absolute top-6 left-0 bottom-0 w-6 overflow-hidden border-r border-[#2c2f38] z-20 pointer-events-none">
        <canvas ref={leftCanvasRef} className="w-full h-full block" />
      </div>
    </>
  );
};
