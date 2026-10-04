import React, { useEffect, useEffectEvent, ViewTransition } from 'react';
import {
  Scissors,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  SunMedium,
  Eraser,
  ScanFace,
  Paintbrush,
  Sparkles,
  Cloud,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

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
};

export const FloatingAIStatusToast: React.FC = () => {
  const { aiStatus, setAIStatus } = useEditorStore();

  const clearToast = useEffectEvent(() => {
    setAIStatus({ statusText: '', error: undefined });
  });

  useEffect(() => {
    if (!aiStatus.isProcessing && (aiStatus.statusText || aiStatus.error)) {
      const timer = setTimeout(() => clearToast(), 4500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is non-reactive
  }, [aiStatus.isProcessing, aiStatus.statusText, aiStatus.error]);

  if (!aiStatus.isProcessing && !aiStatus.statusText && !aiStatus.error) {
    return null;
  }

  const isError = Boolean(aiStatus.error);
  const isComplete = !aiStatus.isProcessing && Boolean(aiStatus.statusText) && !isError;

  const actionIcon = () => {
    switch (aiStatus.action) {
      case 'remove-bg':
        return <Scissors size={18} className="text-[var(--ink-blue)] animate-bounce" />;
      case 'revive':
        return <SunMedium size={18} className="text-[var(--accent-hot)] animate-pulse" />;
      case 'cleanup':
        return <Eraser size={18} className="text-[var(--ink-blue)] animate-pulse" />;
      case 'face-restore':
      case 'portrait-polish':
        return <ScanFace size={18} className="text-[var(--accent)] animate-pulse" />;
      case 'inpaint':
      case 'object-remove':
        return <Paintbrush size={18} className="text-[var(--accent-hot)] animate-pulse" />;
      case 'style':
      case 'relight':
      case 'clarity':
      case 'color-match':
      case 'outpaint':
      case 'batch':
      case 'segment':
      case 'caption':
        return <Sparkles size={18} className="text-[var(--accent)] animate-pulse" />;
      case 'upscale':
        return <Cloud size={18} className="text-[var(--accent)] animate-pulse" />;
      default:
        return <Loader2 size={18} className="text-[var(--accent)] animate-spin" />;
    }
  };

  return (
    <ViewTransition name="ai-status-toast" enter="auto" exit="auto" update="auto">
      <div className="toast-motion fixed top-16 left-1/2 z-50 pointer-events-auto">
        <div
          className={`px-4 py-2.5 rounded-[var(--radius-md)] border backdrop-blur-md flex items-center gap-3 min-w-[280px] max-w-md ${
            isError
              ? 'bg-red-950/90 border-[var(--danger)]/60 text-red-200'
              : isComplete
                ? 'bg-emerald-950/90 border-[var(--success)]/50 text-emerald-100'
                : 'bg-[var(--bg-panel)]/95 border-[var(--accent)]/50 text-[var(--text-primary)]'
          }`}
        >
          <div className="shrink-0">
            {isError ? (
              <AlertCircle size={18} className="text-[var(--danger)]" />
            ) : isComplete ? (
              <CheckCircle size={18} className="text-[var(--success)]" />
            ) : (
              actionIcon()
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between text-xs font-display font-bold">
              <span className="truncate">
                {isError
                  ? 'Failed'
                  : isComplete
                    ? 'Done'
                    : (aiStatus.action && ACTION_LABELS[aiStatus.action]) || 'Processing'}
              </span>
              {aiStatus.isProcessing && (
                <span className="text-[10px] font-mono-ui text-[var(--text-faint)] ml-2">
                  {aiStatus.progress}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {aiStatus.error || aiStatus.statusText || 'Working…'}
            </p>

            {aiStatus.isProcessing && (
              <div className="w-full bg-[var(--bg-app)] h-1 rounded-full overflow-hidden mt-1.5">
                <div
                  className="progress-shimmer h-full transition-all duration-300"
                  style={{ width: `${Math.max(5, aiStatus.progress)}%` }}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => setAIStatus({ isProcessing: false, statusText: '', error: undefined })}
            className="shrink-0 p-1 hover:bg-white/10 rounded-[var(--radius-sm)] cursor-pointer text-[var(--text-faint)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </ViewTransition>
  );
};
