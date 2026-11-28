import React from 'react';
import { SunMedium, Waves, Eraser, Scissors, Maximize } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';
import { useMenuActions } from './useMenuActions';

interface FilterMenuProps {
  onClose: () => void;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({ onClose }) => {
  const {
    setActiveTool,
    removeBackground,
    upscaleLayer,
    bakeClassicFilterOnSelected,
    selectLayer,
    aiStatus,
  } = useEditorStore();
  const { selectedLayerId, isImageSelected, resolveImageId, runRevive, runCleanup } =
    useMenuActions(onClose);

  const runClassicFilter = (
    kind: Parameters<typeof bakeClassicFilterOnSelected>[0],
    params: Record<string, number>
  ) => {
    if (!isImageSelected) return;
    void bakeClassicFilterOnSelected(kind, params);
    onClose();
  };

  const busyOrNoImage = !resolveImageId() || aiStatus.isProcessing;
  const busyOrNotImage = !isImageSelected || aiStatus.isProcessing;

  return (
    <MenuPanel onClose={onClose} width="w-56">
      <Label>Neural</Label>
      <Item disabled={busyOrNoImage} onClick={() => runRevive('natural')}>
        <SunMedium size={13} /> Photo Revive…
      </Item>
      <Item disabled={busyOrNoImage} onClick={() => runRevive('clarity')}>
        Sharpen · Clarity
      </Item>
      <Item disabled={busyOrNoImage} onClick={() => runRevive('film')}>
        Film Glow
      </Item>
      <Item
        disabled={!isImageSelected}
        onClick={() => {
          setActiveTool('liquify');
          onClose();
        }}
        hint="⇧X"
      >
        <Waves size={13} /> Liquify…
      </Item>
      <Sep />
      <Label>Classic / Smart Filters</Label>
      <p className="px-2.5 pb-1 text-[10px] text-[var(--text-faint)] leading-snug">
        On smart objects, filters stay non-destructive and re-bake from the linked source.
      </p>
      <Item disabled={busyOrNotImage} onClick={() => runClassicFilter('gaussian', { radius: 2 })}>
        Gaussian Blur…
      </Item>
      <Item
        disabled={busyOrNotImage}
        onClick={() => runClassicFilter('unsharp', { amount: 80, radius: 1.2, threshold: 0 })}
      >
        Unsharp Mask…
      </Item>
      <Item disabled={busyOrNotImage} onClick={() => runClassicFilter('noise', { amount: 12 })}>
        Add Noise…
      </Item>
      <Item disabled={busyOrNotImage} onClick={() => runClassicFilter('sharpen', { amount: 40 })}>
        Sharpen
      </Item>
      <Item disabled={busyOrNotImage} onClick={() => runClassicFilter('highPass', { radius: 3 })}>
        High Pass…
      </Item>
      <Item
        disabled={busyOrNotImage}
        onClick={() => runClassicFilter('motionBlur', { distance: 14, angle: 0 })}
      >
        Motion Blur…
      </Item>
      <Item
        disabled={busyOrNotImage}
        onClick={() => runClassicFilter('radialBlur', { amount: 35 })}
      >
        Radial Blur…
      </Item>
      <Item disabled={busyOrNotImage} onClick={() => runClassicFilter('median', { radius: 1 })}>
        Median
      </Item>
      <Item
        disabled={busyOrNotImage}
        onClick={() => runClassicFilter('emboss', { amount: 80, angle: 135 })}
      >
        Emboss…
      </Item>
      <Sep />
      <Label>Cleanup</Label>
      <Item disabled={busyOrNoImage} onClick={() => runCleanup('standard')}>
        <Eraser size={13} /> Photo Cleanup…
      </Item>
      <Item disabled={busyOrNoImage} onClick={() => runCleanup('gentle')}>
        Gentle Denoise
      </Item>
      <Item disabled={busyOrNoImage} onClick={() => runCleanup('dust')}>
        Dust & Spots
      </Item>
      <Item disabled={busyOrNoImage} onClick={() => runCleanup('strong')}>
        Strong Denoise
      </Item>
      <Sep />
      <Item
        disabled={busyOrNoImage}
        onClick={() => {
          const id = resolveImageId();
          if (id) {
            selectLayer(id);
            removeBackground(id);
          }
          onClose();
        }}
      >
        <Scissors size={13} /> Remove Background
      </Item>
      <Item
        disabled={busyOrNotImage}
        onClick={() => {
          if (selectedLayerId) upscaleLayer(selectedLayerId, 2);
          onClose();
        }}
      >
        <Maximize size={13} /> Super Resolution…
      </Item>
    </MenuPanel>
  );
};
