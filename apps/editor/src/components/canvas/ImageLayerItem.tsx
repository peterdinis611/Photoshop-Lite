import React, { useEffect, useRef } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { applyImageNodeFilters, useKonvaImage } from '@photoshop-lite/editor-konva';
import { ImageLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface ImageLayerItemProps {
  layer: ImageLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<ImageLayer>) => void;
}

export const ImageLayerItem: React.FC<ImageLayerItemProps> = React.memo(({
  layer,
  onSelect,
  onChange,
}) => {
  const imageRef = useRef<Konva.Image>(null);
  const groupRef = useRef<Konva.Group>(null);
  const { image: imageElement } = useKonvaImage(layer.src);
  const { image: maskElement } = useKonvaImage(
    layer.hasLayerMask ? layer.layerMaskSrc : null
  );
  const clipTarget = useEditorStore((s) =>
    layer.clippingMaskToId
      ? s.layers.find((l) => l.id === layer.clippingMaskToId)
      : undefined
  );
  const activeTool = useEditorStore((s) => s.activeTool);
  const zoom = useEditorStore((s) => s.zoom);
  const canMove = activeTool === 'select' && !layer.locked;

  useEffect(() => {
    if (imageRef.current && imageElement) {
      applyImageNodeFilters(imageRef.current, layer.adjustments);
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [layer.adjustments, imageElement, layer.width, layer.height, layer.src]);

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

  let clipFunc: ((ctx: Konva.Context) => void) | undefined;
  if (clipTarget) {
    clipFunc = (ctx) => {
      const lx = clipTarget.x - layer.x;
      const ly = clipTarget.y - layer.y;
      ctx.rect(
        lx,
        ly,
        clipTarget.width * clipTarget.scaleX,
        clipTarget.height * clipTarget.scaleY
      );
    };
  }

  // Soften when zoomed out; crisp nearest when inspecting pixels close-up
  const imageSmoothingEnabled = zoom < 2.5;

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

  const groupProps = {
    ref: groupRef,
    id: layer.id,
    x: layer.x,
    y: layer.y,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: canMove,
    listening: canMove,
    globalCompositeOperation: layer.blendMode,
    clipFunc,
    onClick: canMove ? onSelect : undefined,
    onTap: canMove ? onSelect : undefined,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      });
    },
    onTransformEnd: commonTransformEnd,
  };

  if (layer.hasLayerMask && maskElement) {
    return (
      <Group {...groupProps}>
        <KonvaImage
          ref={imageRef}
          image={imageElement}
          width={layer.width}
          height={layer.height}
          stroke={styles.stroke}
          strokeWidth={styles.strokeWidth || 0}
          perfectDrawEnabled={false}
          hitStrokeWidth={0}
          imageSmoothingEnabled={imageSmoothingEnabled}
          {...shadowProps}
        />
        <KonvaImage
          image={maskElement}
          width={layer.width}
          height={layer.height}
          globalCompositeOperation="destination-in"
          listening={false}
          perfectDrawEnabled={false}
          imageSmoothingEnabled={imageSmoothingEnabled}
        />
      </Group>
    );
  }

  return (
    <Group {...groupProps}>
      <KonvaImage
        ref={imageRef}
        image={imageElement}
        width={layer.width}
        height={layer.height}
        stroke={styles.stroke}
        strokeWidth={styles.strokeWidth || 0}
        perfectDrawEnabled={false}
        hitStrokeWidth={0}
        imageSmoothingEnabled={imageSmoothingEnabled}
        {...shadowProps}
      />
    </Group>
  );
});
