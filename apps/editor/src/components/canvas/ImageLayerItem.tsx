import React, { useEffect, useMemo, useRef } from 'react';
import { Group, Image as KonvaImage, Rect } from 'react-konva';
import Konva from 'konva';
import { applyImageNodeFilters, useKonvaImage } from '@photoshop-lite/editor-konva';
import { ImageLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import {
  layerShadowProps,
  patternOverlayStyle,
  secondaryStyleOverlays,
} from '../../utils/layerStyleProps';

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
  const shadowProps = layerShadowProps(styles);
  const secondaryFx = secondaryStyleOverlays(styles);
  const pattern = patternOverlayStyle(styles);
  const patternFill = useMemo(() => {
    if (!pattern) return null;
    const cell = pattern.scale;
    const c = document.createElement('canvas');
    c.width = cell;
    c.height = cell;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = pattern.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, cell / 2, cell / 2);
    ctx.fillRect(cell / 2, cell / 2, cell / 2, cell / 2);
    return c;
  }, [pattern]);

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

  const fxOverlays = secondaryFx.map((fx, i) => (
    <Rect
      key={`${fx.kind}-${i}`}
      width={layer.width}
      height={layer.height}
      fill="transparent"
      shadowColor={fx.color}
      shadowBlur={fx.blur}
      shadowOffset={{ x: fx.offsetX, y: fx.offsetY }}
      shadowOpacity={fx.opacity}
      listening={false}
      perfectDrawEnabled={false}
    />
  ));

  const patternOverlay =
    pattern && patternFill ? (
      <Rect
        width={layer.width}
        height={layer.height}
        fillPatternImage={patternFill as unknown as HTMLImageElement}
        fillPatternRepeat="repeat"
        opacity={pattern.opacity}
        listening={false}
      />
    ) : null;

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
        {fxOverlays}
        {patternOverlay}
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
      {fxOverlays}
      {patternOverlay}
    </Group>
  );
});
