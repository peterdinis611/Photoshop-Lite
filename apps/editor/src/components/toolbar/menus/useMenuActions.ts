import { useEditorStore } from '../../../store/editorStore';
import type { ReviveMode } from '../../../utils/photoRevive';
import type { CleanupMode } from '../../../utils/photoCleanup';

/**
 * Layer-targeting helpers shared by the top-bar menus and the action dock.
 * `close` is invoked after each action so the owning menu dismisses itself.
 */
export function useMenuActions(close: () => void) {
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const revivePhotoLayer = useEditorStore((s) => s.revivePhotoLayer);
  const cleanPhotoLayer = useEditorStore((s) => s.cleanPhotoLayer);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImageSelected = selectedLayer?.type === 'image';

  /** Selected image layer, else the top-most image layer. */
  const resolveImageId = () =>
    isImageSelected
      ? selectedLayerId
      : layers.slice().reverse().find((l) => l.type === 'image')?.id ?? null;

  const runRevive = (mode: ReviveMode, bake = false) => {
    const id = resolveImageId();
    if (!id) return;
    selectLayer(id);
    revivePhotoLayer(id, mode, 0.8, bake);
    close();
  };

  const runCleanup = (mode: CleanupMode = 'standard', bake = true) => {
    const id = resolveImageId();
    if (!id) return;
    selectLayer(id);
    cleanPhotoLayer(id, mode, 0.7, bake);
    close();
  };

  const flip = (axis: 'h' | 'v') => {
    if (!selectedLayer) return;
    if (axis === 'h') updateLayer(selectedLayer.id, { scaleX: -selectedLayer.scaleX });
    else updateLayer(selectedLayer.id, { scaleY: -selectedLayer.scaleY });
    close();
  };

  return {
    layers,
    selectedLayerId,
    selectedLayer,
    isImageSelected,
    resolveImageId,
    runRevive,
    runCleanup,
    flip,
  };
}
