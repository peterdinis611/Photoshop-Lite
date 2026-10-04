import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { GitCompare, X } from 'lucide-react';

interface BeforeAfterSliderProps {
  onClose: () => void;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ onClose }) => {
  const { layers, canvasWidth, canvasHeight, backgroundColor } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sliderX, setSliderX] = useState(50); // percent
  const [isDragging, setIsDragging] = useState(false);

  // Render the "after" (current) state on both canvases
  // "Before" = original image sources, "After" = current with all adjustments/filters
  const renderCanvas = useCallback(
    async (canvas: HTMLCanvasElement, useOriginal: boolean) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Background
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        // Checkerboard for transparent
        const size = 16;
        for (let y = 0; y < canvasHeight; y += size) {
          for (let x = 0; x < canvasWidth; x += size) {
            ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#303030' : '#404040';
            ctx.fillRect(x, y, size, size);
          }
        }
      }

      for (const layer of layers) {
        if (!layer.visible) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

        if (layer.type === 'image') {
          const src = useOriginal ? (layer.originalSrc || layer.src) : layer.src;
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
              ctx.rotate((layer.rotation * Math.PI) / 180);
              ctx.scale(layer.scaleX, layer.scaleY);
              ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          });
        }
        ctx.restore();
      }
    },
    [layers, canvasWidth, canvasHeight, backgroundColor]
  );

  useEffect(() => {
    if (beforeCanvasRef.current) renderCanvas(beforeCanvasRef.current, true);
    if (afterCanvasRef.current) renderCanvas(afterCanvasRef.current, false);
  }, [renderCanvas]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setSliderX((x / rect.width) * 100);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const displayScale = Math.min(
    (containerRef.current?.clientWidth || 800) / canvasWidth,
    (containerRef.current?.clientHeight || 600) / canvasHeight,
    1
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={onClose}>
      {/* Panel */}
      <div
        className="relative bg-[#1a1b20] border border-[#2c2f38] rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2f38] bg-[#18191d]">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm">
            <GitCompare size={16} className="text-blue-400" />
            Before / After Comparison
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Slider Container */}
        <div
          ref={containerRef}
          className="relative overflow-hidden select-none"
          style={{
            width: Math.min(canvasWidth, 900),
            height: Math.min(canvasHeight * (Math.min(900, canvasWidth) / canvasWidth), 600),
          }}
        >
          {/* Before canvas (original) - full width */}
          <canvas
            ref={beforeCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />

          {/* After canvas (current) - clipped to right side of slider */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              clipPath: `inset(0 ${100 - sliderX}% 0 0)`,
            }}
          >
            <canvas
              ref={afterCanvasRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 pointer-events-none"
            style={{ left: `${sliderX}%` }}
          />

          {/* Drag Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 cursor-ew-resize"
            style={{ left: `${sliderX}%` }}
            onMouseDown={() => setIsDragging(true)}
          >
            <div className="w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-blue-500">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M5 9H13M5 9L3 7M5 9L3 11M13 9L15 7M13 9L15 11" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 text-[11px] font-bold text-zinc-300 z-10 select-none">
            BEFORE
          </div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 text-[11px] font-bold text-blue-300 z-10 select-none">
            AFTER
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#2c2f38] text-center text-[11px] text-zinc-500">
          Drag the divider to compare original vs. edited. Click outside to close.
        </div>
      </div>
    </div>
  );
};
