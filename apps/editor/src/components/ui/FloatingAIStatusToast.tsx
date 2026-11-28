import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

const ACTION_LABELS: Record<string, string> = {
  'remove-bg': 'Cutout',
  revive: 'Photo Revive',
  cleanup: 'Photo Cleanup',
  upscale: 'Upscale',
  'face-restore': 'Face Restore',
  inpaint: 'Inpaint',
  'object-remove': 'Object Remove',
  style: 'Style Transfer',
  relight: 'Relight',
  'portrait-polish': 'Portrait Polish',
  clarity: 'Clarity',
  'color-match': 'Color Match',
  outpaint: 'Outpaint',
  batch: 'Batch Lab',
  segment: 'Segment',
  caption: 'Caption',
  colorize: 'Colorize',
  uncrop: 'Uncrop',
  reimagine: 'Reimagine',
};

/**
 * Bridges store `aiStatus` into Sonner — one toast id so progress → done/error animates in place.
 */
export function FloatingAIStatusToast() {
  const aiStatus = useEditorStore((s) => s.aiStatus);
  const setAIStatus = useEditorStore((s) => s.setAIStatus);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }

    const label =
      (aiStatus.action && ACTION_LABELS[aiStatus.action]) || 'Neural Lab';
    const idle = !aiStatus.isProcessing && !aiStatus.statusText && !aiStatus.error;

    if (idle) {
      notify.ai.dismiss();
    } else if (aiStatus.error) {
      notify.ai.error('Failed', aiStatus.error);
      clearTimer.current = setTimeout(() => {
        setAIStatus({ statusText: '', error: undefined });
      }, 4500);
    } else if (aiStatus.isProcessing) {
      const detail = aiStatus.statusText
        ? `${aiStatus.statusText} · ${aiStatus.progress}%`
        : `${aiStatus.progress}%`;
      notify.ai.loading(label, detail);
    } else if (aiStatus.statusText) {
      notify.ai.success('Done', aiStatus.statusText);
      clearTimer.current = setTimeout(() => {
        setAIStatus({ statusText: '', error: undefined });
      }, 4500);
    }

    return () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };
  }, [
    aiStatus.isProcessing,
    aiStatus.statusText,
    aiStatus.error,
    aiStatus.progress,
    aiStatus.action,
    setAIStatus,
  ]);

  return null;
}
