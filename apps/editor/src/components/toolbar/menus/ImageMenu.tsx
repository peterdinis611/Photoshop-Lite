import React from 'react';
import {
  SunMedium,
  Sparkles,
  Aperture,
  Eraser,
  Contrast,
  Palette,
  Info,
  FileArchive,
  Crop,
  Scaling,
  Maximize,
} from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';
import { useMenuActions } from './useMenuActions';

interface ImageMenuProps {
  onClose: () => void;
}

export const ImageMenu: React.FC<ImageMenuProps> = ({ onClose }) => {
  const {
    updateAdjustments,
    colorizeSelectedImage,
    inspectSelectedExif,
    compressSelectedImage,
    setActiveTool,
    setImageSizeModalOpen,
    setNewCanvasModalOpen,
    upscaleLayer,
    aiStatus,
  } = useEditorStore();
  const { selectedLayerId, isImageSelected, resolveImageId, runRevive, runCleanup } =
    useMenuActions(onClose);

  return (
    <MenuPanel onClose={onClose} width="w-60">
      <Label>Adjustments</Label>
      <Item disabled={!resolveImageId()} onClick={() => runRevive('natural')}>
        <SunMedium size={13} /> Auto Tone (Revive)
      </Item>
      <Item disabled={!resolveImageId()} onClick={() => runRevive('vivid')}>
        <Sparkles size={13} /> Auto Contrast (Vivid)
      </Item>
      <Item disabled={!resolveImageId()} onClick={() => runRevive('shadows')}>
        <Aperture size={13} /> Shadow Lift
      </Item>
      <Item disabled={!resolveImageId()} onClick={() => runCleanup('standard')}>
        <Eraser size={13} /> Photo Cleanup
      </Item>
      <Item
        disabled={!isImageSelected}
        onClick={() => {
          if (selectedLayerId && isImageSelected) {
            updateAdjustments(selectedLayerId, { saturation: -100, grayscale: true });
          }
          onClose();
        }}
      >
        <Contrast size={13} /> Desaturate
      </Item>
      <Item
        disabled={!isImageSelected}
        onClick={() => {
          if (selectedLayerId && isImageSelected) {
            updateAdjustments(selectedLayerId, { invert: true });
          }
          onClose();
        }}
      >
        Invert
      </Item>
      <Item
        disabled={!isImageSelected || aiStatus.isProcessing}
        onClick={() => {
          void colorizeSelectedImage('sepia', 0.85);
          onClose();
        }}
      >
        <Palette size={13} /> Colorize (Sepia)
      </Item>
      <Item
        disabled={!isImageSelected || aiStatus.isProcessing}
        onClick={() => {
          void colorizeSelectedImage('teal-orange', 0.8);
          onClose();
        }}
      >
        <Palette size={13} /> Colorize (Teal · Orange)
      </Item>
      <Sep />
      <Label>Size & info</Label>
      <Item
        disabled={!isImageSelected}
        onClick={() => {
          void inspectSelectedExif();
          onClose();
        }}
      >
        <Info size={13} /> Image Info / EXIF…
      </Item>
      <Item
        disabled={!isImageSelected || aiStatus.isProcessing}
        onClick={() => {
          void compressSelectedImage({ maxEdge: 2048, quality: 0.82, format: 'image/jpeg' });
          onClose();
        }}
      >
        <FileArchive size={13} /> Compress (2K JPEG)
      </Item>
      <Item
        onClick={() => {
          setActiveTool('crop');
          onClose();
        }}
        hint="C"
      >
        <Crop size={13} /> Crop…
      </Item>
      <Item
        disabled={!isImageSelected}
        onClick={() => {
          setImageSizeModalOpen(true);
          onClose();
        }}
      >
        <Scaling size={13} /> Image Size… / Optimize
      </Item>
      <Item
        disabled={!isImageSelected || aiStatus.isProcessing}
        onClick={() => {
          if (selectedLayerId) upscaleLayer(selectedLayerId, 2);
          onClose();
        }}
      >
        <Maximize size={13} /> Upscale 2×
      </Item>
      <Item
        disabled={!isImageSelected || aiStatus.isProcessing}
        onClick={() => {
          if (selectedLayerId) upscaleLayer(selectedLayerId, 4);
          onClose();
        }}
      >
        <Maximize size={13} /> Upscale 4×
      </Item>
      <Item onClick={() => { setNewCanvasModalOpen(true); onClose(); }}>
        Canvas Size…
      </Item>
    </MenuPanel>
  );
};
