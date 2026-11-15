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
    body: 'The right sidebar holds Layers, Tone, Neural Lab, Style, History, and Actions. Click the active tab again — or the edge toggle — to collapse it to a slim rail and give the canvas room.',
    tips: ['Revive = tone & color', 'Cutout = background removal'],
  },
  {
    id: 'actions',
    eyebrow: 'Actions · 05',
    title: 'Record macros',
    body: 'Open the Actions tab (film icon) and hit Record, edit as usual, then stop. Replay the same steps on any other photo — handy for repeat looks.',
    tips: ['A red badge on the tab means recording is live', 'Lab → Batch applies a look to many files'],
  },
  {
    id: 'menus',
    eyebrow: 'Menus · 06',
    title: 'Filter menu & Stock & CC',
    body: 'The classic Filter menu has Revive, Cleanup, Remove Background, and more. File → Stock & CC Photos pulls free-licence images straight onto the canvas.',
    tips: ['Stock & CC is also on the empty canvas', 'File → Save to Cloud when the API is running'],
  },
  {
    id: 'ship',
    eyebrow: 'Ship · 07',
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

export { STORAGE_KEY };
