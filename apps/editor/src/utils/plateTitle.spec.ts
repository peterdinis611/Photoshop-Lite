import { describe, expect, it } from 'vitest';
import {
  commitPlateTitle,
  DEFAULT_PLATE_TITLE,
  isUnnamedPlate,
  plateRenameDraft,
  resolvePlateTitle,
} from './plateTitle';

describe('plateTitle', () => {
  it('resolves empty to Untitled plate', () => {
    expect(resolvePlateTitle('')).toBe(DEFAULT_PLATE_TITLE);
    expect(resolvePlateTitle('   ')).toBe(DEFAULT_PLATE_TITLE);
    expect(resolvePlateTitle(null)).toBe(DEFAULT_PLATE_TITLE);
    expect(resolvePlateTitle('Sunset dock')).toBe('Sunset dock');
  });

  it('detects unnamed plates case-insensitively', () => {
    expect(isUnnamedPlate('')).toBe(true);
    expect(isUnnamedPlate('Untitled')).toBe(true);
    expect(isUnnamedPlate('untitled plate')).toBe(true);
    expect(isUnnamedPlate('Untitled Plate')).toBe(true);
    expect(isUnnamedPlate('Portrait v2')).toBe(false);
  });

  it('opens rename with empty draft when unnamed', () => {
    expect(plateRenameDraft('Untitled')).toBe('');
    expect(plateRenameDraft('My plate')).toBe('My plate');
  });

  it('commits blank draft back to default', () => {
    expect(commitPlateTitle('')).toBe(DEFAULT_PLATE_TITLE);
    expect(commitPlateTitle('  Glow  ')).toBe('Glow');
  });
});
