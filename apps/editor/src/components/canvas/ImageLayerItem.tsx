import React, { useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { ImageLayer } from '../../types/editor';
import { applyImageNodeFilters } from './konvaFilters';
import { useEditorStore } from '../../store/editorStore';

interface ImageLayerItemProps {
  layer: ImageLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<ImageLayer>) => void;
}

export const ImageLayerItem: React.FC<ImageLayerItemProps> = ({
  layer,
  isSelected,
  onSelect,
  onChange,
}) => {
  const imageRef = useRef<Konva.Image>(null);
  const groupRef = useRef<Konva.Group>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [maskElement, setMaskElement] = useState<HTMLImageElement | null>(null);
  const layers = useEditorStore((s) => s.layers);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = layer.src;
    img.onload = () => setImageElement(img);
  }, [layer.src]);

  useEffect(() => {
    if (!layer.hasLayerMask || !layer.layerMaskSrc) {
      setMaskElement(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = layer.layerMaskSrc;
    img.onload = () => setMaskElement(img);
  }, [layer.hasLayerMask, layer.layerMaskSrc]);

  // Apply filters whenever adjustments change
  useEffect(() => {
    if (imageRef.current && imageElement) {
      applyImageNodeFilters(imageRef.current, layer.adjustments);
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [layer.adjustments, imageElement, layer.width, layer.height]);

  if (!layer.visible || !imageElement) {
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

  // Clipping mask: clip this layer to the bounds of the target layer below
  let clipFunc: ((ctx: Konva.Context) => void) | undefined;
  if (layer.clippingMaskToId) {
    const clipTarget = layers.find((l) => l.id === layer.clippingMaskToId);
    if (clipTarget) {
      clipFunc = (ctx) => {
        // Clip in group-local space: convert target bounds relative to this layer
        const lx = clipTarget.x - layer.x;
        const ly = clipTarget.y - layer.y;
        ctx.rect(lx, ly, clipTarget.width * clipTarget.scaleX, clipTarget.height * clipTarget.scaleY);
      };
    }
  }

  const commonTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      rotation: Math.round(node.rotation()),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    });
  };

  // With layer mask: composite via destination-in (white=show, black=hide → use luminance as alpha)
  if (layer.hasLayerMask && maskElement) {
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
        clipFunc={clipFunc}
        onClick={canMove ? onSelect : undefined}
        onTap={canMove ? onSelect : undefined}
        onDragEnd={(e) => {
          onChange({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={commonTransformEnd}
      >
        <KonvaImage
          ref={imageRef}
          image={imageElement}
          width={layer.width}
          height={layer.height}
          stroke={styles.stroke}
          strokeWidth={styles.strokeWidth || 0}
          {...shadowProps}
        />
        <KonvaImage
          image={maskElement}
          width={layer.width}
          height={layer.height}
          globalCompositeOperation="destination-in"
          listening={false}
        />
      </Group>
    );
  }

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
      clipFunc={clipFunc}
      onClick={canMove ? onSelect : undefined}
      onTap={canMove ? onSelect : undefined}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={commonTransformEnd}
    >
      <KonvaImage
        ref={imageRef}
        image={imageElement}
        width={layer.width}
        height={layer.height}
        stroke={styles.stroke}
        strokeWidth={styles.strokeWidth || 0}
        {...shadowProps}
      />
    </Group>
  );
};
