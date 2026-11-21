import React, { useEffect, useEffectEvent, useRef } from 'react';
import type { Driver } from 'driver.js';
import { useEditorStore } from '../../store/editorStore';
import { ONBOARDING_STEPS, markOnboardingComplete } from './onboardingSteps';

async function buildDriver(onDone: () => void): Promise<Driver> {
  const [{ driver }, _css] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);

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
        element: '[data-tour="tour-sidebar"]',
        popover: {
          title: ONBOARDING_STEPS[4].title,
          description: ONBOARDING_STEPS[4].body,
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '[data-tour="tour-nav"]',
        popover: {
          title: ONBOARDING_STEPS[5].title,
          description: ONBOARDING_STEPS[5].body,
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="tour-project-title"]',
        popover: {
          title: ONBOARDING_STEPS[6].title,
          description: `${ONBOARDING_STEPS[6].body} Tip: click the project name to rename.`,
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

/** Product tour powered by driver.js (loaded on demand). */
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

    let cancelled = false;
    let t = 0;

    void buildDriver(() => finish()).then((d) => {
      if (cancelled) {
        d.destroy();
        return;
      }
      driverRef.current = d;
      t = window.setTimeout(() => d.drive(), 120);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [open]);

  return null;
};
