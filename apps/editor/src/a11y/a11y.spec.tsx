import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SkipLink } from './SkipLink';
import { LiveRegion } from './LiveRegion';
import { LandingPage } from '../pages/LandingPage';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('a11y primitives', () => {
  it('renders skip link targeting href', () => {
    render(<SkipLink href="#document-canvas">Skip to canvas</SkipLink>);
    const link = screen.getByRole('link', { name: /skip to canvas/i, hidden: true });
    expect(link.getAttribute('href')).toBe('#document-canvas');
    expect(link.classList.contains('skip-link')).toBe(true);
  });

  it('exposes live region status', () => {
    render(<LiveRegion message="Layer selected" />);
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('Layer selected');
  });
});

describe('LandingPage a11y', () => {
  it('has skip links, main landmark, and labeled stack region', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    const skip = screen.getByRole('link', { name: /skip to open editor/i, hidden: true });
    expect(skip.getAttribute('href')).toBe('#landing-cta');
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('region', { name: /interactive layer stack/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /open editor/i }).length).toBeGreaterThan(0);
  });
});
