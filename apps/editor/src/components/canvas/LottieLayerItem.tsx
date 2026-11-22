import React, { useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import lottie, { type AnimationItem } from 'lottie-web';
import type { LottieLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface LottieLayerItemProps {
  layer: LottieLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<LottieLayer>) => void;
}

export const LottieLayerItem: React.FC<LottieLayerItemProps> = React.memo(
  ({ layer, onSelect, onChange }) => {
    const imageRef = useRef<Konva.Image>(null);
    const groupRef = useRef<Konva.Group>(null);
    const animRef = useRef<AnimationItem | null>(null);
    const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
    const activeTool = useEditorStore((s) => s.activeTool);
    const canMove = activeTool === 'select' && !layer.locked;

    // Boot / rebuild player when composition or size changes
    useEffect(() => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(layer.width));
      canvas.height = Math.max(1, Math.round(layer.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let anim: AnimationItem;
      try {
        anim = lottie.loadAnimation({
          renderer: 'canvas',
          loop: layer.loop,
          autoplay: layer.playing,
          animationData: structuredClone(layer.animationData),
          rendererSettings: {
            context: ctx,
            clearCanvas: true,
            preserveAspectRatio: 'xMidYMid meet',
          },
        } as Parameters<typeof lottie.loadAnimation>[0]);
      } catch {
        return;
      }

      anim.setSpeed(layer.speed);
      animRef.current = anim;
      setCanvasEl(canvas);

      // Coalesce enterFrame storms into one Konva paint per animation frame
      let raf = 0;
      const onFrame = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const node = imageRef.current;
          if (!node) return;
          node.getLayer()?.batchDraw();
        });
      };
      anim.addEventListener('enterFrame', onFrame);

      return () => {
        anim.removeEventListener('enterFrame', onFrame);
        if (raf) cancelAnimationFrame(raf);
        anim.destroy();
        if (animRef.current === anim) animRef.current = null;
      };
      // animationData identity + size — playback props synced below
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [layer.id, layer.animationData, layer.width, layer.height]);

    // Sync playback controls without rebuilding
    useEffect(() => {
      const anim = animRef.current;
      if (!anim) return;
      anim.loop = layer.loop;
      anim.setSpeed(layer.speed);
      if (layer.playing) {
        if (anim.isPaused) anim.play();
      } else if (!anim.isPaused) {
        anim.pause();
      }
    }, [layer.loop, layer.playing, layer.speed]);

    if (!layer.visible || !canvasEl) {
      return null;
    }

    const styles = layer.styles || {};
    const useGlow = (styles.outerGlowBlur || 0) > 0;
    const shadowProps = useGlow
      ? {
          shadowColor: styles.outerGlowColor || '#e8a84a',
          shadowBlur: styles.outerGlowBlur || 0,
          shadowOffset: { x: 0, y: 0 },
          shadowOpacity: 0.85,
        }
      : {
          shadowColor: styles.shadowColor,
          shadowBlur: styles.shadowBlur || 0,
          shadowOffset: {
            x: styles.shadowOffsetX || 0,
            y: styles.shadowOffsetY || 0,
          },
          shadowOpacity: styles.shadowOpacity || 0,
        };

    return (
      <Group
        ref={groupRef}
        id={layer.id}
        x={layer.x}
        y={layer.y}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={canMove}
        listening={canMove}
        globalCompositeOperation={layer.blendMode}
        onClick={canMove ? onSelect : undefined}
        onTap={canMove ? onSelect : undefined}
        onDragEnd={(e) => {
          onChange({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          onChange({
            x: Math.round(node.x()),
            y: Math.round(node.y()),
            rotation: Math.round(node.rotation()),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
          });
        }}
      >
        <KonvaImage
          ref={imageRef}
          image={canvasEl}
          width={layer.width}
          height={layer.height}
          {...shadowProps}
          stroke={styles.stroke}
          strokeWidth={styles.strokeWidth || 0}
          perfectDrawEnabled={false}
          hitStrokeWidth={0}
        />
      </Group>
    );
  }
);

LottieLayerItem.displayName = 'LottieLayerItem';
