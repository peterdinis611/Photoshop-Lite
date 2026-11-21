const UNNAMED_RE = /^untitled(\s+plate)?$/i;

/** Default document name when the user has not named the plate. */
export const DEFAULT_PLATE_TITLE = 'Untitled plate';

export function resolvePlateTitle(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  return trimmed || DEFAULT_PLATE_TITLE;
}

/** True when the plate still needs a real name (empty / Untitled / Untitled plate). */
export function isUnnamedPlate(raw: string | null | undefined): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return true;
  return UNNAMED_RE.test(trimmed);
}

/** Draft shown when opening rename — empty for unnamed so placeholder shows. */
export function plateRenameDraft(raw: string | null | undefined): string {
  return isUnnamedPlate(raw) ? '' : resolvePlateTitle(raw);
}

/** Commit rename — blank input falls back to the default plate name. */
export function commitPlateTitle(draft: string): string {
  return draft.trim() || DEFAULT_PLATE_TITLE;
}
