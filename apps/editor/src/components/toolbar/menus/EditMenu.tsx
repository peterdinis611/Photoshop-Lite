import React from 'react';
import {
  Undo2,
  Redo2,
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  Maximize2,
  Settings,
  Keyboard,
  Compass,
} from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';
import { useMenuActions } from './useMenuActions';

interface EditMenuProps {
  onClose: () => void;
}

export const EditMenu: React.FC<EditMenuProps> = ({ onClose }) => {
  const {
    undo,
    redo,
    past,
    future,
    duplicateLayer,
    removeLayer,
    updateLayer,
    setLayerOpacity,
    canvasWidth,
    canvasHeight,
    setSettingsModalOpen,
    setShortcutsModalOpen,
    setOnboardingOpen,
  } = useEditorStore();
  const { selectedLayer, selectedLayerId, flip } = useMenuActions(onClose);

  const centerLayer = () => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      x: Math.round((canvasWidth - selectedLayer.width * Math.abs(selectedLayer.scaleX)) / 2),
      y: Math.round((canvasHeight - selectedLayer.height * Math.abs(selectedLayer.scaleY)) / 2),
    });
    onClose();
  };

  const rotateLayer = (delta: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      rotation: ((selectedLayer.rotation ?? 0) + delta + 360) % 360,
    });
    onClose();
  };

  const setOpacity = (opacity: number) => {
    if (selectedLayerId) setLayerOpacity(selectedLayerId, opacity);
    onClose();
  };

  return (
    <MenuPanel onClose={onClose} width="w-52">
      <Item disabled={past.length === 0} onClick={() => { undo(); onClose(); }} hint="⌘Z">
        <Undo2 size={13} /> Undo
      </Item>
      <Item disabled={future.length === 0} onClick={() => { redo(); onClose(); }} hint="⌘Y">
        <Redo2 size={13} /> Redo
      </Item>
      <Sep />
      <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) duplicateLayer(selectedLayerId); onClose(); }} hint="⌘D">
        <Copy size={13} /> Duplicate
      </Item>
      <Item disabled={!selectedLayerId} danger onClick={() => { if (selectedLayerId) removeLayer(selectedLayerId); onClose(); }} hint="Del">
        <Trash2 size={13} /> Delete
      </Item>
      <Sep />
      <Item disabled={!selectedLayer} onClick={() => flip('h')}>
        <FlipHorizontal size={13} /> Flip Horizontal
      </Item>
      <Item disabled={!selectedLayer} onClick={() => flip('v')}>
        <FlipVertical size={13} /> Flip Vertical
      </Item>
      <Item disabled={!selectedLayer} onClick={() => rotateLayer(90)}>
        <RotateCw size={13} /> Rotate 90° CW
      </Item>
      <Item disabled={!selectedLayer} onClick={() => rotateLayer(-90)}>
        <RotateCcw size={13} /> Rotate 90° CCW
      </Item>
      <Item disabled={!selectedLayer} onClick={centerLayer}>
        <Maximize2 size={13} /> Center on Canvas
      </Item>
      <Sep />
      <Label>Opacity</Label>
      <Item disabled={!selectedLayerId} onClick={() => setOpacity(1)}>
        100%
      </Item>
      <Item disabled={!selectedLayerId} onClick={() => setOpacity(0.5)}>
        50%
      </Item>
      <Item disabled={!selectedLayerId} onClick={() => setOpacity(0.25)}>
        25%
      </Item>
      <Item onClick={() => { setSettingsModalOpen(true); onClose(); }} hint="⌘,">
        <Settings size={13} /> Preferences…
      </Item>
      <Item onClick={() => { setShortcutsModalOpen(true); onClose(); }} hint="⌘/">
        <Keyboard size={13} /> Keyboard Shortcuts…
      </Item>
      <Item onClick={() => { setOnboardingOpen(true); onClose(); }} hint="⌘⇧/">
        <Compass size={13} /> Product Tour…
      </Item>
    </MenuPanel>
  );
};
