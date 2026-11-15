import React from 'react';
import { Square, SquareDashed, PenTool } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';

interface SelectMenuProps {
  onClose: () => void;
}

export const SelectMenu: React.FC<SelectMenuProps> = ({ onClose }) => {
  const {
    layers,
    selectedLayerId,
    selectLayer,
    setActiveTool,
    marqueeSelection,
    setMarqueeSelection,
    modifyMarqueeSelection,
    pathToSelection,
    strokePathAsDrawing,
  } = useEditorStore();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const runSelectionModify = (
    op: Parameters<typeof modifyMarqueeSelection>[0],
    amount?: number
  ) => {
    if (!marqueeSelection) return;
    void modifyMarqueeSelection(op, amount);
    onClose();
  };

  return (
    <MenuPanel onClose={onClose} width="w-52">
      <Item onClick={() => { setActiveTool('marquee'); onClose(); }} hint="M">
        <Square size={13} /> Rectangular Marquee
      </Item>
      <Item onClick={() => { setActiveTool('select'); onClose(); }} hint="V">
        Move Tool
      </Item>
      <Sep />
      <Item onClick={() => { selectLayer(null); onClose(); }} hint="Esc">
        Deselect Layer
      </Item>
      <Item
        disabled={layers.length === 0}
        onClick={() => {
          const top = layers[layers.length - 1];
          if (top) selectLayer(top.id);
          onClose();
        }}
      >
        Select Top Layer
      </Item>
      <Sep />
      <Label>Selection</Label>
      <Item
        disabled={!marqueeSelection}
        onClick={() => {
          setMarqueeSelection(null);
          onClose();
        }}
      >
        <SquareDashed size={13} /> Deselect
      </Item>
      <Item disabled={!marqueeSelection} onClick={() => runSelectionModify('invert')}>
        Invert Selection
      </Item>
      <Label>Modify</Label>
      <Item disabled={!marqueeSelection} onClick={() => runSelectionModify('expand', 10)}>
        Expand… <span className="text-[var(--text-faint)]">10 px</span>
      </Item>
      <Item disabled={!marqueeSelection} onClick={() => runSelectionModify('contract', 10)}>
        Contract… <span className="text-[var(--text-faint)]">10 px</span>
      </Item>
      <Item disabled={!marqueeSelection} onClick={() => runSelectionModify('feather', 8)}>
        Feather… <span className="text-[var(--text-faint)]">8 px</span>
      </Item>
      <Sep />
      <Label>Path</Label>
      <Item
        disabled={selectedLayer?.type !== 'path'}
        onClick={() => {
          pathToSelection();
          onClose();
        }}
      >
        <PenTool size={13} /> Path to Selection
      </Item>
      <Item
        disabled={selectedLayer?.type !== 'path'}
        onClick={() => {
          strokePathAsDrawing();
          onClose();
        }}
      >
        <PenTool size={13} /> Stroke Path
      </Item>
    </MenuPanel>
  );
};
