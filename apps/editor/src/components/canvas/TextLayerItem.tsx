import React, { useRef } from 'react';
import { Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { TextLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface TextLayerItemProps {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<TextLayer>) => void;
}

export const TextLayerItem: React.FC<TextLayerItemProps> = ({
  layer,
  isSelected: _isSelected,
  onSelect,
  onChange,
}) => {
  const textRef = useRef<Konva.Text>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;

  if (!layer.visible) return null;

  const handleDblClick = () => {
    const textNode = textRef.current;
    if (!textNode) return;

    // Direct inline text editing overlay
    const stage = textNode.getStage();
    if (!stage) return;

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    };

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = layer.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${Math.max(120, textNode.width() * textNode.scaleX())}px`;
    textarea.style.fontSize = `${layer.fontSize * stage.scaleX()}px`;
    textarea.style.fontFamily = layer.fontFamily;
    textarea.style.color = layer.fill;
    textarea.style.border = '1px solid #3b82f6';
    textarea.style.padding = '4px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'rgba(20, 20, 25, 0.9)';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = String(layer.lineHeight);
    textarea.style.zIndex = '9999';

    textarea.focus();
    textarea.select();

    const removeTextarea = () => {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
      onChange({ text: textarea.value });
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        removeTextarea();
      }
      if (e.key === 'Escape') {
        if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
      }
    });

    textarea.addEventListener('blur', () => {
      removeTextarea();
    });
  };

  const styles = layer.styles || {};
  const useGlow = (styles.outerGlowBlur || 0) > 0;

  return (
    <KonvaText
      ref={textRef}
      id={layer.id}
      text={layer.text}
      x={layer.x}
      y={layer.y}
      width={Math.max(40, layer.width)}
      height={Math.max(
        layer.fontSize * layer.lineHeight,
        layer.height || layer.fontSize * layer.lineHeight
      )}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      rotation={layer.rotation}
      opacity={layer.opacity}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={layer.fontStyle}
      align={layer.align}
      fill={layer.fill}
      stroke={layer.stroke}
      strokeWidth={layer.strokeWidth || 0}
      letterSpacing={layer.letterSpacing}
      lineHeight={layer.lineHeight}
      textDecoration={layer.textDecoration}
      draggable={canMove}
      listening={canMove || activeTool === 'text'}
      globalCompositeOperation={layer.blendMode}
      // Hit the whole box, not just glyph pixels — Move needs a solid drag target
      hitStrokeWidth={Math.max(12, layer.fontSize)}
      shadowColor={useGlow ? styles.outerGlowColor || '#e8a84a' : styles.shadowColor}
      shadowBlur={useGlow ? styles.outerGlowBlur || 0 : styles.shadowBlur || 0}
      shadowOffset={
        useGlow
          ? { x: 0, y: 0 }
          : { x: styles.shadowOffsetX || 0, y: styles.shadowOffsetY || 0 }
      }
      shadowOpacity={useGlow ? 0.85 : styles.shadowOpacity || 0}
      onClick={canMove ? onSelect : undefined}
      onTap={canMove ? onSelect : undefined}
      onDblClick={canMove || activeTool === 'text' ? handleDblClick : undefined}
      onDblTap={canMove || activeTool === 'text' ? handleDblClick : undefined}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = textRef.current;
        if (!node) return;
        const sx = node.scaleX();
        const sy = node.scaleY();
        // Bake scale into box width + font size so Size / Box W stay editable
        const nextWidth = Math.max(40, Math.round(Math.abs(node.width() * sx)));
        const nextFontSize = Math.max(8, Math.round(layer.fontSize * Math.abs(sy)));
        const lines = Math.max(1, layer.text.split('\n').length);
        node.scaleX(sx < 0 ? -1 : 1);
        node.scaleY(sy < 0 ? -1 : 1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation: Math.round(node.rotation()),
          width: nextWidth,
          height: Math.max(nextFontSize, Math.round(nextFontSize * layer.lineHeight * lines)),
          fontSize: nextFontSize,
          scaleX: sx < 0 ? -1 : 1,
          scaleY: sy < 0 ? -1 : 1,
        });
      }}
    />
  );
};
