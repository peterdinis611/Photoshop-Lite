import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { ErrorPage } from './ErrorPage';
import { ErrorBoundary } from '../components/ErrorBoundary';

afterEach(() => cleanup());

describe('NotFoundPage', () => {
  it('renders 404 darkroom copy and home link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Frame not found/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open the darkroom/i }).getAttribute('href')).toBe(
      '/'
    );
  });
});

describe('ErrorPage', () => {
  it('shows error detail and reload action', () => {
    render(
      <MemoryRouter>
        <ErrorPage error={new Error('Develop failed')} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Plate fogged/i)).toBeTruthy();
    expect(screen.getByText(/Develop failed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reload page/i })).toBeTruthy();
  });
});

describe('ErrorBoundary + routing', () => {
  it('catches child render errors', () => {
    const Boom = () => {
      throw new Error('Boom plate');
    };

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText(/Plate fogged/i)).toBeTruthy();
    expect(screen.getByText(/Boom plate/)).toBeTruthy();
  });

  it('shows NotFound for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-reel']}>
        <Routes>
          <Route path="/" element={<div>editor</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Frame not found/i)).toBeTruthy();
  });
});
