import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  buildDraftFromState,
  clearDraft,
  loadDraft,
  saveDraft,
} from '../utils/draftAutosave';
import { notify } from '../utils/notify';

const AUTOSAVE_MS = 2500;

/**
 * Debounced IndexedDB draft of the open document + one-shot restore prompt.
 * Skips when a cloud deep-link is present (cloud load wins).
 */
export function useDraftAutosave(): void {
  const timerRef = useRef<number | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    // Scrub any legacy secret keys left from older builds
    try {
      localStorage.removeItem('px_remove_bg_key');
      localStorage.removeItem('px_replicate_key');
    } catch {
      /* ignore */
    }

    if (restoredRef.current) return;
    restoredRef.current = true;

    const cloudId = new URLSearchParams(window.location.search).get('cloud');
    if (cloudId) return;

    let cancelled = false;
    void (async () => {
      const snap = await loadDraft();
      if (cancelled || !snap) return;
      const state = useEditorStore.getState();
      // Don't clobber an already-open document (e.g. demo / drop race)
      if (state.isDocumentOpen && state.layers.length > 0) return;

      const when = new Date(snap.savedAt).toLocaleString();
      notify.info('Draft found', `Autosaved ${when} — restoring`);
      state.loadProject(snap.project);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state, prev) => {
      if (!state.isDocumentOpen && state.layers.length === 0) {
        if (prev.isDocumentOpen || prev.layers.length > 0) {
          void clearDraft();
        }
        return;
      }

      const dirty =
        state.layers !== prev.layers ||
        state.canvasWidth !== prev.canvasWidth ||
        state.canvasHeight !== prev.canvasHeight ||
        state.backgroundColor !== prev.backgroundColor ||
        state.projectTitle !== prev.projectTitle;

      if (!dirty) return;

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const s = useEditorStore.getState();
        if (!s.isDocumentOpen && s.layers.length === 0) return;
        const project = buildDraftFromState(s);
        void saveDraft(project);
      }, AUTOSAVE_MS);
    });

    const onUnload = () => {
      const s = useEditorStore.getState();
      if (!s.isDocumentOpen && s.layers.length === 0) return;
      // Best-effort sync write path isn't available for IDB; fire-and-forget.
      void saveDraft(buildDraftFromState(s));
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      unsub();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('pagehide', onUnload);
    };
  }, []);
}
