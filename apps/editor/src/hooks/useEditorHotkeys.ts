import { useMemo, type RefObject } from 'react';
import { useHotkeys, type UseHotkeyDefinition } from '@tanstack/react-hotkeys';
import { useEditorStore } from '../store/editorStore';
import { clearImageSelection } from '../utils/maskHelpers';
import { markOnboardingComplete } from '../components/onboarding/OnboardingTour';
import type { ToolType } from '../types/editor';

type FitFn = () => void;

/**
 * Photoshop-style editor shortcuts powered by TanStack Hotkeys.
 */
export function useEditorHotkeys(options: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
  onFitToScreen: FitFn;
}) {
  const { canvasContainerRef, onFitToScreen } = options;

  const defs = useMemo<UseHotkeyDefinition[]>(() => {
    const tool = (hotkey: string, id: ToolType, name: string): UseHotkeyDefinition => ({
      hotkey,
      callback: () => useEditorStore.getState().setActiveTool(id),
      options: { meta: { name, group: 'Tools', description: `Activate ${name}` } },
    });

    return [
      // ── File / document ─────────────────────────────────────────
      {
        hotkey: 'Mod+S',
        callback: () => useEditorStore.getState().saveProject(),
        options: { meta: { name: 'Save Project', group: 'File' } },
      },
      {
        hotkey: 'Mod+Shift+S',
        callback: () => {
          void useEditorStore.getState().saveProjectToCloud();
        },
        options: { meta: { name: 'Save to Cloud', group: 'File' } },
      },
      {
        hotkey: 'Mod+E',
        callback: () => useEditorStore.getState().setExportModalOpen(true),
        options: { meta: { name: 'Export', group: 'File' } },
      },
      {
        hotkey: 'Mod+N',
        callback: () => useEditorStore.getState().setNewCanvasModalOpen(true),
        options: { meta: { name: 'New Document', group: 'File' } },
      },
      {
        hotkey: 'Mod+,',
        callback: () => useEditorStore.getState().setSettingsModalOpen(true),
        options: { meta: { name: 'Settings', group: 'File' } },
      },
      {
        hotkey: 'Mod+/',
        callback: () => useEditorStore.getState().setShortcutsModalOpen(true),
        options: { meta: { name: 'Keyboard Shortcuts', group: 'Help' } },
      },
      {
        hotkey: 'Shift+/',
        callback: () => useEditorStore.getState().setShortcutsModalOpen(true),
        options: {
          meta: { name: 'Keyboard Shortcuts (?)', group: 'Help' },
          conflictBehavior: 'allow',
        },
      },

      // ── History ─────────────────────────────────────────────────
      {
        hotkey: 'Mod+Z',
        callback: () => useEditorStore.getState().undo(),
        options: { meta: { name: 'Undo', group: 'Edit' } },
      },
      {
        hotkey: 'Mod+Shift+Z',
        callback: () => useEditorStore.getState().redo(),
        options: { meta: { name: 'Redo', group: 'Edit' } },
      },
      {
        hotkey: 'Mod+Y',
        callback: () => useEditorStore.getState().redo(),
        options: { meta: { name: 'Redo (Alt)', group: 'Edit' } },
      },
      {
        hotkey: 'Mod+D',
        callback: () => {
          const { selectedLayerId, duplicateLayer } = useEditorStore.getState();
          if (selectedLayerId) duplicateLayer(selectedLayerId);
        },
        options: { meta: { name: 'Duplicate Layer', group: 'Edit' } },
      },

      // ── View ────────────────────────────────────────────────────
      {
        hotkey: 'Mod+0',
        callback: () => onFitToScreen(),
        options: { meta: { name: 'Fit to Screen', group: 'View' } },
      },
      {
        hotkey: 'Mod+1',
        callback: () => useEditorStore.getState().setZoom(1),
        options: { meta: { name: 'Actual Size (100%)', group: 'View' } },
      },
      {
        hotkey: 'Mod+=',
        callback: () =>
          useEditorStore.getState().setZoom((z) => Math.min(8, Number((z * 1.25).toFixed(3)))),
        options: { meta: { name: 'Zoom In', group: 'View' } },
      },
      {
        hotkey: 'Mod+-',
        callback: () =>
          useEditorStore.getState().setZoom((z) => Math.max(0.1, Number((z / 1.25).toFixed(3)))),
        options: { meta: { name: 'Zoom Out', group: 'View' } },
      },
      {
        hotkey: "Mod+'",
        callback: () => useEditorStore.getState().toggleGrid(),
        options: { meta: { name: 'Toggle Grid', group: 'View' } },
      },
      {
        hotkey: 'Mod+;',
        callback: () => useEditorStore.getState().toggleRulers(),
        options: { meta: { name: 'Toggle Rulers', group: 'View' } },
      },
      {
        hotkey: '\\',
        callback: () => {
          const s = useEditorStore.getState();
          s.setBeforeAfterOpen(!s.isBeforeAfterOpen);
        },
        options: { meta: { name: 'Before / After', group: 'View' } },
      },

      // ── Selection / delete ──────────────────────────────────────
      {
        hotkey: 'Escape',
        callback: () => {
          const s = useEditorStore.getState();
          if (s.isOnboardingOpen) {
            markOnboardingComplete();
            s.setOnboardingOpen(false);
            return;
          }
          if (s.cropSettings.active) {
            s.cancelCrop();
            return;
          }
          s.setMarqueeSelection(null);
          s.setShortcutsModalOpen(false);
        },
        options: { meta: { name: 'Clear Selection / Close', group: 'Select' }, requireReset: true },
      },
      {
        hotkey: 'Enter',
        callback: () => {
          const s = useEditorStore.getState();
          if (s.cropSettings.active) {
            void s.applyCrop();
          }
        },
        options: { meta: { name: 'Apply Crop', group: 'Image' } },
      },
      {
        hotkey: 'Mod+Shift+/',
        callback: () => useEditorStore.getState().setOnboardingOpen(true),
        options: { meta: { name: 'Product Tour', group: 'Help' } },
      },
      {
        hotkey: 'Delete',
        callback: () => clearOrDelete(),
        options: { meta: { name: 'Delete / Clear', group: 'Edit' } },
      },
      {
        hotkey: 'Backspace',
        callback: () => clearOrDelete(),
        options: { meta: { name: 'Delete / Clear', group: 'Edit' } },
      },

      // ── Layer nudge ─────────────────────────────────────────────
      {
        hotkey: 'ArrowUp',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(0, -1),
        options: { meta: { name: 'Nudge Up', group: 'Layer' } },
      },
      {
        hotkey: 'ArrowDown',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(0, 1),
        options: { meta: { name: 'Nudge Down', group: 'Layer' } },
      },
      {
        hotkey: 'ArrowLeft',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(-1, 0),
        options: { meta: { name: 'Nudge Left', group: 'Layer' } },
      },
      {
        hotkey: 'ArrowRight',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(1, 0),
        options: { meta: { name: 'Nudge Right', group: 'Layer' } },
      },
      {
        hotkey: 'Shift+ArrowUp',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(0, -10),
        options: { meta: { name: 'Nudge Up 10px', group: 'Layer' } },
      },
      {
        hotkey: 'Shift+ArrowDown',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(0, 10),
        options: { meta: { name: 'Nudge Down 10px', group: 'Layer' } },
      },
      {
        hotkey: 'Shift+ArrowLeft',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(-10, 0),
        options: { meta: { name: 'Nudge Left 10px', group: 'Layer' } },
      },
      {
        hotkey: 'Shift+ArrowRight',
        callback: () => useEditorStore.getState().nudgeSelectedLayer(10, 0),
        options: { meta: { name: 'Nudge Right 10px', group: 'Layer' } },
      },
      {
        hotkey: 'Mod+Shift+H',
        callback: () => {
          const { selectedLayerId, layers, updateLayer } = useEditorStore.getState();
          const layer = layers.find((l) => l.id === selectedLayerId);
          if (layer) updateLayer(layer.id, { scaleX: -layer.scaleX });
        },
        options: { meta: { name: 'Flip Horizontal', group: 'Layer' } },
      },
      {
        hotkey: 'Mod+Shift+V',
        callback: () => {
          const { selectedLayerId, layers, updateLayer } = useEditorStore.getState();
          const layer = layers.find((l) => l.id === selectedLayerId);
          if (layer) updateLayer(layer.id, { scaleY: -layer.scaleY });
        },
        options: { meta: { name: 'Flip Vertical', group: 'Layer' } },
      },
      {
        hotkey: 'Mod+Shift+L',
        callback: () => {
          const { selectedLayerId, toggleLayerLock } = useEditorStore.getState();
          if (selectedLayerId) toggleLayerLock(selectedLayerId);
        },
        options: { meta: { name: 'Toggle Layer Lock', group: 'Layer' } },
      },
      {
        hotkey: 'Mod+Shift+Period',
        callback: () => {
          const { selectedLayerId, toggleLayerVisibility } = useEditorStore.getState();
          if (selectedLayerId) toggleLayerVisibility(selectedLayerId);
        },
        options: { meta: { name: 'Toggle Layer Visibility', group: 'Layer' } },
      },

      // ── Brush / colors ──────────────────────────────────────────
      {
        hotkey: 'X',
        callback: () => useEditorStore.getState().swapBrushColors(),
        options: { meta: { name: 'Swap Colors', group: 'Brush' } },
      },
      {
        hotkey: 'D',
        callback: () => useEditorStore.getState().resetBrushColors(),
        options: { meta: { name: 'Default Colors', group: 'Brush' } },
      },
      {
        hotkey: '[',
        callback: () => {
          const { brushSettings, updateBrushSettings } = useEditorStore.getState();
          updateBrushSettings({ size: Math.max(1, brushSettings.size - 4) });
        },
        options: { meta: { name: 'Brush Size −', group: 'Brush' } },
      },
      {
        hotkey: ']',
        callback: () => {
          const { brushSettings, updateBrushSettings } = useEditorStore.getState();
          updateBrushSettings({ size: Math.min(300, brushSettings.size + 4) });
        },
        options: { meta: { name: 'Brush Size +', group: 'Brush' } },
      },
      {
        hotkey: 'Shift+[',
        callback: () => {
          const { brushSettings, updateBrushSettings } = useEditorStore.getState();
          updateBrushSettings({
            hardness: Math.max(0, Number((brushSettings.hardness - 0.1).toFixed(2))),
          });
        },
        options: { meta: { name: 'Hardness −', group: 'Brush' } },
      },
      {
        hotkey: 'Shift+]',
        callback: () => {
          const { brushSettings, updateBrushSettings } = useEditorStore.getState();
          updateBrushSettings({
            hardness: Math.min(1, Number((brushSettings.hardness + 0.1).toFixed(2))),
          });
        },
        options: { meta: { name: 'Hardness +', group: 'Brush' } },
      },

      // ── Tools ───────────────────────────────────────────────────
      tool('V', 'select', 'Move'),
      tool('M', 'marquee', 'Marquee'),
      tool('L', 'lasso', 'Lasso'),
      tool('W', 'wand', 'Magic Wand'),
      tool('C', 'crop', 'Crop'),
      tool('B', 'brush', 'Brush'),
      tool('E', 'eraser', 'Eraser'),
      tool('G', 'fill', 'Paint Bucket'),
      tool('R', 'blur', 'Blur'),
      {
        hotkey: 'Shift+R',
        callback: () => useEditorStore.getState().setActiveTool('refineBrush'),
        options: { meta: { name: 'Refine Edge', group: 'Tools' } },
      },
      tool('J', 'spotHealing', 'Spot Healing'),
      tool('S', 'clone', 'Clone Stamp'),
      tool('I', 'eyedropper', 'Eyedropper'),
      tool('T', 'text', 'Type'),
      tool('U', 'shape', 'Shape'),
      tool('H', 'hand', 'Hand'),
      tool('Z', 'zoom', 'Zoom'),
    ];
    // canvasContainerRef reserved for future target-scoped zoom
    void canvasContainerRef;
  }, [canvasContainerRef, onFitToScreen]);

  useHotkeys(defs, { conflictBehavior: 'allow' });
}

function clearOrDelete() {
  const state = useEditorStore.getState();
  const sel = state.marqueeSelection;
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  if (sel && layer?.type === 'image') {
    state.commitHistory('Clear Selection');
    void clearImageSelection({
      src: layer.src,
      layerX: layer.x,
      layerY: layer.y,
      layerWidth: layer.width,
      layerHeight: layer.height,
      selection: sel,
    }).then((newSrc) => {
      state.updateLayer(layer.id, { src: newSrc });
      state.setMarqueeSelection(null);
    });
    return;
  }
  if (state.selectedLayerId) {
    state.removeLayer(state.selectedLayerId);
  }
}
