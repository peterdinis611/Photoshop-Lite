import React from 'react';
import { Ruler, Plus, Trash, Keyboard, Compass } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';

interface ViewMenuProps {
  onClose: () => void;
  onFitToScreen: () => void;
}

export const ViewMenu: React.FC<ViewMenuProps> = ({ onClose, onFitToScreen }) => {
  const {
    setZoom,
    showGrid,
    showRulers,
    toggleGrid,
    toggleRulers,
    canvasWidth,
    canvasHeight,
    guides,
    snapToGuides,
    setSnapToGuides,
    addGuide,
    clearGuides,
    setShortcutsModalOpen,
    setOnboardingOpen,
  } = useEditorStore();

  return (
    <MenuPanel onClose={onClose} width="w-56">
      <Item onClick={() => { onFitToScreen(); onClose(); }} hint="⌘0">
        Fit on Screen
      </Item>
      <Item onClick={() => { setZoom(1); onClose(); }} hint="⌘1">
        100%
      </Item>
      <Item onClick={() => { setZoom((z) => Math.min(8, z * 1.25)); onClose(); }} hint="⌘=">
        Zoom In
      </Item>
      <Item onClick={() => { setZoom((z) => Math.max(0.1, z / 1.25)); onClose(); }} hint="⌘-">
        Zoom Out
      </Item>
      <Sep />
      <Item onClick={() => { toggleRulers(); onClose(); }} hint="⌘;">
        Rulers {showRulers ? '✓' : ''}
      </Item>
      <Item onClick={() => { toggleGrid(); onClose(); }} hint="⌘'">
        Pixel Grid {showGrid ? '✓' : ''}
      </Item>
      <Sep />
      <Label>Guides</Label>
      <Item onClick={() => { setSnapToGuides(!snapToGuides); onClose(); }}>
        <Ruler size={13} /> Snap to Guides {snapToGuides ? '✓' : ''}
      </Item>
      <Item onClick={() => { addGuide('horizontal', Math.round(canvasHeight / 2)); onClose(); }}>
        <Plus size={13} /> New Horizontal Guide
      </Item>
      <Item onClick={() => { addGuide('vertical', Math.round(canvasWidth / 2)); onClose(); }}>
        <Plus size={13} /> New Vertical Guide
      </Item>
      <Item disabled={guides.length === 0} onClick={() => { clearGuides(); onClose(); }}>
        <Trash size={13} /> Clear Guides
      </Item>
      <Sep />
      <Item onClick={() => { setShortcutsModalOpen(true); onClose(); }} hint="⌘/">
        <Keyboard size={13} /> Shortcuts
      </Item>
      <Item onClick={() => { setOnboardingOpen(true); onClose(); }} hint="⌘⇧/">
        <Compass size={13} /> Product Tour
      </Item>
    </MenuPanel>
  );
};
