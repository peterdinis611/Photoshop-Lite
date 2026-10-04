import React, { useEffect, useEffectEvent, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useEditorStore } from '../../store/editorStore';

const STORAGE_KEY = 'px_onboarding_done';

/** Kept for tests / docs — maps to driver.js steps. */
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    eyebrow: 'Darkroom · 01',
    title: 'Welcome to PhotoshopLite',
    body: 'A browser darkroom for layers, retouch, and AI. This short tour shows the workspace — skip anytime and reopen from Edit → Product Tour.',
    tips: ['Drop photos onto the empty canvas to start', 'Everything runs locally unless you use Cloud Lab'],
  },
  {
    id: 'tools',
    eyebrow: 'Tools · 02',
    title: 'Left tool rail',
    body: 'Select Move (V) to drag layers. Brush (B) paints — pick color at the bottom swatches or in the options bar.',
    tips: ['B brush · E eraser · G fill · R blur', '[ ] change brush size · X swap colors'],
  },
  {
    id: 'canvas',
    eyebrow: 'Canvas · 03',
    title: 'Canvas & project',
    body: 'The center stage is your document. Click the project name in the top bar to rename it. Drop large photos — the document sizes to fit.',
    tips: ['⌘0 fit · ⌘1 actual size', 'Image → Image Size… to shrink / optimize'],
  },
  {
    id: 'sidebar',
    eyebrow: 'Panels · 04',
    title: 'Layers, Tone & Lab',
    body: 'Right sidebar holds Layers, Tone, Neural Lab, Style, and History. Open Lab for Revive, Clarity, Color Match, Outpaint, Batch, and cloud jobs.',
    tips: ['Revive = tone & color', 'Cutout = background removal'],
  },
  {
    id: 'ship',
    eyebrow: 'Ship · 05',
    title: 'Save & export',
    body: '⌘S saves a local project. ⌘⇧S saves to the API cloud (workspace-isolated). ⌘E exports PNG/JPEG/WEBP.',
    tips: ['Edit → Keyboard Shortcuts for the full list', 'Replay this tour anytime from Edit → Product Tour'],
  },
] as const;

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function buildDriver(onDone: () => void): Driver {
  return driver({
    animate: true,
    allowClose: true,
    overlayOpacity: 0.72,
    overlayColor: '#0b0c0f',
    stagePadding: 8,
    stageRadius: 10,
    smoothScroll: true,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Start editing',
    popoverClass: 'px-driver-popover',
    steps: [
      {
        element: '[data-tour="tour-nav"]',
        popover: {
          title: ONBOARDING_STEPS[0].title,
          description: ONBOARDING_STEPS[0].body,
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="tour-tools"]',
        popover: {
          title: ONBOARDING_STEPS[1].title,
          description: ONBOARDING_STEPS[1].body,
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="tour-canvas"]',
        popover: {
          title: ONBOARDING_STEPS[2].title,
          description: ONBOARDING_STEPS[2].body,
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '[data-tour="tour-sidebar"]',
        popover: {
          title: ONBOARDING_STEPS[3].title,
          description: ONBOARDING_STEPS[3].body,
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '[data-tour="tour-project-title"]',
        popover: {
          title: ONBOARDING_STEPS[4].title,
          description: `${ONBOARDING_STEPS[4].body} Tip: click the project name to rename.`,
          side: 'bottom',
          align: 'start',
        },
      },
    ],
    onDestroyed: () => {
      markOnboardingComplete();
      onDone();
    },
  });
}

/** Product tour powered by driver.js */
export const OnboardingTour: React.FC = () => {
  const open = useEditorStore((s) => s.isOnboardingOpen);
  const setOpen = useEditorStore((s) => s.setOnboardingOpen);
  const driverRef = useRef<Driver | null>(null);

  const finish = useEffectEvent(() => {
    setOpen(false);
  });

  useEffect(() => {
    if (!open) {
      driverRef.current?.destroy();
      driverRef.current = null;
      return;
    }

    const d = buildDriver(() => finish());
    driverRef.current = d;
    // Small delay so layout/data-tour targets are painted
    const t = window.setTimeout(() => d.drive(), 120);
    return () => {
      window.clearTimeout(t);
      d.destroy();
      driverRef.current = null;
    };
  }, [open, finish]);

  return null;
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is non-reactive
  }, []);
}
