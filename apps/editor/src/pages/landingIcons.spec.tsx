import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  ApertureIcon,
  ArrowUpRightIcon,
  BrushIcon,
  CropIcon,
  ScissorsIcon,
  SparklesIcon,
  WandIcon,
} from './landingIcons';

describe('landingIcons', () => {
  it('renders inline SVGs without lucide dependency', () => {
    const icons = [
      ArrowUpRightIcon,
      BrushIcon,
      CropIcon,
      ScissorsIcon,
      SparklesIcon,
      WandIcon,
      ApertureIcon,
    ];
    for (const Icon of icons) {
      const { container } = render(<Icon size={18} strokeWidth={2.2} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('width')).toBe('18');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
