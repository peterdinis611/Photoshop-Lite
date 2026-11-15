import React from 'react';
import {
  Type,
  Square,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Lock,
  Unlock,
  Blend,
  Layers as LayersIcon,
  Replace,
  Frame,
} from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';
import { useMenuActions } from './useMenuActions';

interface LayerMenuProps {
  onClose: () => void;
  onReplaceSmartObject: () => void;
}

const ADJUSTMENT_KINDS = [
  ['brightness', 'Brightness'],
  ['curves', 'Curves'],
  ['hueSaturation', 'Hue / Saturation'],
  ['levels', 'Levels'],
  ['invert', 'Invert'],
  ['grayscale', 'Grayscale'],
] as const;

export const LayerMenu: React.FC<LayerMenuProps> = ({ onClose, onReplaceSmartObject }) => {
  const {
    addTextLayer,
    addShapeLayer,
    setActiveTool,
    duplicateLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    toggleLayerLock,
    addAdjustmentLayer,
    convertSelectedToSmartObject,
    addArtboard,
    artboards,
  } = useEditorStore();
  const { layers, selectedLayerId, selectedLayer, isImageSelected } = useMenuActions(onClose);

  const isSmartObject = selectedLayer?.type === 'image' && !!selectedLayer.smartObject;
  const selectedIndex = layers.findIndex((l) => l.id === selectedLayerId);

  const moveLayer = (dir: 'up' | 'down') => {
    if (selectedIndex < 0) return;
    const to = dir === 'up' ? selectedIndex + 1 : selectedIndex - 1;
    if (to < 0 || to >= layers.length) return;
    reorderLayers(selectedIndex, to);
    onClose();
  };

  return (
    <MenuPanel onClose={onClose} width="w-52">
      <Item
        onClick={() => {
          addTextLayer();
          setActiveTool('text');
          onClose();
        }}
      >
        <Type size={13} /> New Text Layer
      </Item>
      <Item
        onClick={() => {
          addShapeLayer('rectangle');
          setActiveTool('shape');
          onClose();
        }}
      >
        <Square size={13} /> New Shape Layer
      </Item>
      <Sep />
      <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) duplicateLayer(selectedLayerId); onClose(); }}>
        <Copy size={13} /> Duplicate Layer
      </Item>
      <Item disabled={!selectedLayerId} danger onClick={() => { if (selectedLayerId) removeLayer(selectedLayerId); onClose(); }}>
        <Trash2 size={13} /> Delete Layer
      </Item>
      <Sep />
      <Item disabled={selectedIndex < 0 || selectedIndex >= layers.length - 1} onClick={() => moveLayer('up')}>
        <ArrowUp size={13} /> Bring Forward
      </Item>
      <Item disabled={selectedIndex <= 0} onClick={() => moveLayer('down')}>
        <ArrowDown size={13} /> Send Backward
      </Item>
      <Sep />
      <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) toggleLayerVisibility(selectedLayerId); onClose(); }}>
        <EyeOff size={13} /> Toggle Visibility
      </Item>
      <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) toggleLayerLock(selectedLayerId); onClose(); }}>
        {selectedLayer?.locked ? <Unlock size={13} /> : <Lock size={13} />}{' '}
        {selectedLayer?.locked ? 'Unlock' : 'Lock'} Layer
      </Item>
      <Sep />
      <Label>Add Adjustment Layer</Label>
      {ADJUSTMENT_KINDS.map(([kind, label]) => (
        <Item
          key={kind}
          onClick={() => {
            addAdjustmentLayer(kind);
            onClose();
          }}
        >
          <Blend size={13} /> {label}
        </Item>
      ))}
      <Sep />
      <Item
        disabled={!isImageSelected || isSmartObject}
        onClick={() => {
          convertSelectedToSmartObject();
          onClose();
        }}
      >
        <LayersIcon size={13} /> Convert to Smart Object
      </Item>
      <Item disabled={!isSmartObject} onClick={onReplaceSmartObject}>
        <Replace size={13} /> Replace Contents…
      </Item>
      <Sep />
      <Label>Artboards</Label>
      <Item
        onClick={() => {
          addArtboard();
          onClose();
        }}
      >
        <Frame size={13} /> New Artboard
        {artboards.length > 0 && (
          <span className="text-[var(--text-faint)]"> ({artboards.length})</span>
        )}
      </Item>
    </MenuPanel>
  );
};
