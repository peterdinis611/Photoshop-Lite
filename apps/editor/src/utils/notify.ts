import { toast } from 'sonner';

const AI_TOAST_ID = 'ai-status';

/** Darkroom-themed toast helpers (Sonner). */
export const notify = {
  success(message: string, description?: string) {
    return toast.success(message, { description });
  },
  error(message: string, description?: string) {
    return toast.error(message, { description });
  },
  info(message: string, description?: string) {
    return toast.message(message, { description });
  },
  loading(message: string, description?: string) {
    return toast.loading(message, { description });
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
  /** Shared id so AI progress/success/error replace one toast. */
  ai: {
    id: AI_TOAST_ID,
    loading(message: string, description?: string) {
      return toast.loading(message, { id: AI_TOAST_ID, description });
    },
    success(message: string, description?: string) {
      return toast.success(message, { id: AI_TOAST_ID, description });
    },
    error(message: string, description?: string) {
      return toast.error(message, { id: AI_TOAST_ID, description });
    },
    dismiss() {
      toast.dismiss(AI_TOAST_ID);
    },
  },
};

export { toast };
