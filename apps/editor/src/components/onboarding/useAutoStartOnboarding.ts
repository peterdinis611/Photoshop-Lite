import { useEffect, useEffectEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { hasCompletedOnboarding } from './onboardingSteps';

/** Call once on app mount to open tour for first-time visitors. */
export function useAutoStartOnboarding() {
  const setOpen = useEditorStore((s) => s.setOnboardingOpen);

  const openTour = useEffectEvent(() => {
    setOpen(true);
  });

  useEffect(() => {
    if (hasCompletedOnboarding()) return;
    const t = window.setTimeout(() => openTour(), 700);
    return () => window.clearTimeout(t);
  }, []);
}
