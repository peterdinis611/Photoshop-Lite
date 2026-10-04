import React, {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
  ViewTransition,
} from 'react';
import {
  ArrowRight,
  Check,
  Layers,
  MousePointer2,
  Sparkles,
  Keyboard,
  Download,
  Paintbrush,
  X,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

const STORAGE_KEY = 'px_onboarding_done';

export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    eyebrow: 'Darkroom · 01',
    title: 'Welcome to PhotoshopLite',
    body: 'A browser darkroom for layers, retouch, and AI. This short tour shows the workspace — skip anytime and reopen from Edit → Product Tour.',
    icon: Sparkles,
    tips: ['Drop photos onto the empty canvas to start', 'Everything runs locally unless you use Cloud Lab'],
  },
  {
    id: 'tools',
    eyebrow: 'Tools · 02',
    title: 'Left tool rail',
    body: 'Select Move (V) to drag layers. Brush (B) paints — pick color at the bottom swatches or in the options bar. Marquee / Lasso / Wand build selections for delete or Inpaint.',
    icon: Paintbrush,
    tips: ['B brush · E eraser · G fill · R blur', '[ ] change brush size · X swap colors'],
  },
  {
    id: 'canvas',
    eyebrow: 'Canvas · 03',
    title: 'Canvas & layers',
    body: 'The center stage is your document. Right sidebar holds Layers, Tone, Neural Lab, Style, and History. Duplicate with ⌘D, nudge with arrow keys.',
    icon: Layers,
    tips: ['⌘0 fit · ⌘1 actual size · scroll to pan', 'Hold Space for temporary Hand tool'],
  },
  {
    id: 'lab',
    eyebrow: 'Neural Lab · 04',
    title: 'Revive, Clean, Cutout',
    body: 'Top dock actions enhance photos fast. Open the Lab tab for Photo Revive, Cleanup, Cloud jobs (needs API + REPLICATE_API_TOKEN), and style / caption tools.',
    icon: MousePointer2,
    tips: ['Revive = tone & color', 'Cutout = background removal (WASM or remove.bg)'],
  },
  {
    id: 'ship',
    eyebrow: 'Ship · 05',
    title: 'Save, shortcuts, export',
    body: '⌘S saves a local .pslite project. ⌘⇧S saves to the local API cloud. ⌘E exports PNG/JPEG/WEBP. ⌘/ opens the full shortcut cheatsheet.',
    icon: Download,
    tips: ['Edit → Keyboard Shortcuts for the full list', 'You can replay this tour anytime'],
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

export const OnboardingTour: React.FC = () => {
  const open = useEditorStore((s) => s.isOnboardingOpen);
  const setOpen = useEditorStore((s) => s.setOnboardingOpen);
  const [step, setStep] = useState(0);

  const resetStep = useEffectEvent(() => {
    setStep(0);
  });

  useEffect(() => {
    if (open) resetStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is non-reactive
  }, [open]);

  if (!open) return null;

  const current = ONBOARDING_STEPS[step];
  const Icon = current.icon;
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const finish = () => {
    markOnboardingComplete();
    setOpen(false);
  };

  const goTo = (index: number) => {
    startTransition(() => setStep(index));
  };

  const next = () => {
    if (isLast) finish();
    else goTo(step + 1);
  };

  const back = () => goTo(Math.max(0, step - 1));

  return (
    <div className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="modal-card relative w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div
          className="absolute inset-x-0 top-0 h-28 pointer-events-none opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 20% 0%, rgba(212,146,58,0.22), transparent 70%), radial-gradient(ellipse 60% 80% at 90% 10%, rgba(91,141,239,0.12), transparent 65%)',
          }}
        />

        <button
          type="button"
          onClick={finish}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>

        <div className="relative px-6 pt-7 pb-5">
          <ViewTransition name="onboarding-step" update="auto" enter="auto" exit="auto">
            <div key={current.id}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--accent)] text-[#1a1208] flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
                  <Icon size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[10px] font-mono-ui uppercase tracking-[0.14em] text-[var(--accent-hot)]">
                    {current.eyebrow}
                  </p>
                  <p className="text-[10px] font-mono-ui text-[var(--text-faint)] mt-0.5">
                    Step {step + 1} of {ONBOARDING_STEPS.length}
                  </p>
                </div>
              </div>

              <h2
                id="onboarding-title"
                className="font-display font-extrabold text-[1.45rem] leading-tight text-[var(--text-primary)] tracking-tight"
              >
                {current.title}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {current.body}
              </p>

              <ul className="mt-4 flex flex-col gap-2">
                {current.tips.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2 text-[12px] text-[var(--text-muted)] bg-[var(--bg-app)]/70 border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2"
                  >
                    <Check size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ViewTransition>

          <div className="mt-6 flex items-center gap-1.5">
            {ONBOARDING_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === step
                    ? 'w-7 bg-[var(--accent)]'
                    : i < step
                      ? 'w-3 bg-[var(--accent)]/50'
                      : 'w-3 bg-[var(--border-strong)]'
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={finish}
              className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-muted)] cursor-pointer px-1"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="px-3 py-2 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  Back
                </button>
              )}
              <button type="button" onClick={next} className="dock-export !min-h-[34px]">
                {isLast ? (
                  <>
                    <Check size={14} strokeWidth={2.4} />
                    Start editing
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} strokeWidth={2.4} />
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[10px] font-mono-ui text-[var(--text-faint)]">
            <Keyboard size={11} />
            Esc closes · React 19.3 View Transitions · ⌘/ shortcuts
          </p>
        </div>
      </div>
    </div>
  );
};

/** Call once on app mount to open tour for first-time visitors. */
export function useAutoStartOnboarding() {
  const setOpen = useEditorStore((s) => s.setOnboardingOpen);

  const openTour = useEffectEvent(() => {
    setOpen(true);
  });

  useEffect(() => {
    if (hasCompletedOnboarding()) return;
    const t = window.setTimeout(() => openTour(), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is non-reactive
  }, []);
}
