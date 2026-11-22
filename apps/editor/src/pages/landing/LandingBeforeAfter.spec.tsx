import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LandingBeforeAfter } from './LandingBeforeAfter';

describe('LandingBeforeAfter', () => {
  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);
    window.dataLayer = [];
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.dataLayer;
  });

  it('renders slider and tracks first interaction', async () => {
    render(<LandingBeforeAfter />);
    const slider = screen.getByRole('slider', { name: /before and after/i });
    await waitFor(() => expect(slider.className).toContain('is-sharp'));
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([expect.objectContaining({ event: 'before_after_interact' })])
    );
  });
});
