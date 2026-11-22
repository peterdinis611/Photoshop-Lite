import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';

export interface UISlice {
  isExportModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isOnboardingOpen: boolean;
  isBeforeAfterOpen: boolean;
  secondaryColor: string;
  isSettingsModalOpen: boolean;
  isNewCanvasModalOpen: boolean;
  isImageSizeModalOpen: boolean;
  isStockModalOpen: boolean;
  isExifModalOpen: boolean;
  isIconifyModalOpen: boolean;
  isVersionHistoryModalOpen: boolean;
  isFillModalOpen: boolean;
  isColorRangeModalOpen: boolean;
  isSelectAndMaskModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setNewCanvasModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;
  setImageSizeModalOpen: (open: boolean) => void;
  setStockModalOpen: (open: boolean) => void;
  setExifModalOpen: (open: boolean) => void;
  setIconifyModalOpen: (open: boolean) => void;
  setVersionHistoryModalOpen: (open: boolean) => void;
  setFillModalOpen: (open: boolean) => void;
  setColorRangeModalOpen: (open: boolean) => void;
  setSelectAndMaskModalOpen: (open: boolean) => void;
  setBeforeAfterOpen: (open: boolean) => void;
  setSecondaryColor: (color: string) => void;
  swapBrushColors: () => void;
  resetBrushColors: () => void;
}

export const createUISlice: StateCreator<EditorStore, [], [], UISlice> = (set, get) => ({
  isExportModalOpen: false,

  isImageSizeModalOpen: false,

  isStockModalOpen: false,

  isExifModalOpen: false,

  isIconifyModalOpen: false,

  isVersionHistoryModalOpen: false,

  isFillModalOpen: false,

  isColorRangeModalOpen: false,

  isSelectAndMaskModalOpen: false,

  isShortcutsModalOpen: false,

  isOnboardingOpen: false,

  isBeforeAfterOpen: false,

  secondaryColor: '#ece8e1',

  isSettingsModalOpen: false,

  isNewCanvasModalOpen: false,

  setExportModalOpen: (open) => set({ isExportModalOpen: open }),

  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  setNewCanvasModalOpen: (open) => set({ isNewCanvasModalOpen: open }),

  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),

  setOnboardingOpen: (open) => set({ isOnboardingOpen: open }),

  setImageSizeModalOpen: (open) => set({ isImageSizeModalOpen: open }),

  setStockModalOpen: (open) => set({ isStockModalOpen: open }),

  setExifModalOpen: (open) => set({ isExifModalOpen: open }),

  setIconifyModalOpen: (open) => set({ isIconifyModalOpen: open }),

  setVersionHistoryModalOpen: (open) => set({ isVersionHistoryModalOpen: open }),

  setFillModalOpen: (open) => set({ isFillModalOpen: open }),

  setColorRangeModalOpen: (open) => set({ isColorRangeModalOpen: open }),

  setSelectAndMaskModalOpen: (open) => set({ isSelectAndMaskModalOpen: open }),

  setBeforeAfterOpen: (open) => set({ isBeforeAfterOpen: open }),

  setSecondaryColor: (color) => set({ secondaryColor: color }),

  swapBrushColors: () =>
    set((state) => ({
      secondaryColor: state.brushSettings.color,
      brushSettings: { ...state.brushSettings, color: state.secondaryColor },
    })),

  resetBrushColors: () =>
    set({
      secondaryColor: '#ece8e1',
      brushSettings: { ...get().brushSettings, color: '#d4923a' },
    }),
});
