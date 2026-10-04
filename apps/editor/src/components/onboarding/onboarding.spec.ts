import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
  ONBOARDING_STEPS,
} from './OnboardingTour';

const STORAGE_KEY = 'px_onboarding_done';

describe('onboarding helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('exposes a complete tour sequence', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(4);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.body.length).toBeGreaterThan(10);
      expect(step.tips.length).toBeGreaterThan(0);
    }
  });

  it('starts incomplete and marks complete in localStorage', () => {
    expect(hasCompletedOnboarding()).toBe(false);
    markOnboardingComplete();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(hasCompletedOnboarding()).toBe(true);
  });

  it('treats only exact flag as complete', () => {
    localStorage.setItem(STORAGE_KEY, 'yes');
    expect(hasCompletedOnboarding()).toBe(false);
    localStorage.setItem(STORAGE_KEY, '1');
    expect(hasCompletedOnboarding()).toBe(true);
  });
});
