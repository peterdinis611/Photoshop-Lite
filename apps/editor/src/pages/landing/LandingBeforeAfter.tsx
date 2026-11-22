import React, { useCallback, useEffect, useRef, useState } from 'react';
import { trackCta } from '../../analytics/trackCta';

/** Tiny WebP LQIP — inlined so first paint never waits on the network. */
const BEFORE_LQIP =
  'data:image/webp;base64,UklGRoIAAABXRUJQVlA4IHYAAADQAwCdASoYAA4APzmGulOvKKWisAgB4CcJQBbZAlcLYqfw4jqYai4A/svGy37PaRNPMZfAQ/3ySGjb5UySMHPrSWflnEQLB09tn1fuckgMbK/sIrXyhikchf02b7b1gquYG0jj+IMmcs+seKUxYm52k3syoAAA';
const AFTER_LQIP =
  'data:image/webp;base64,UklGRngAAABXRUJQVlA4IGwAAADQAwCdASoYAA4APzmEuVOvKKWisAgB4CcJYgCdACEr+MjWMFDzlHgA/s8dt2spQVw3W86L5DgU1LXR1coT6fAjxXR5jbPhRV7TUnhOU9EUJgbiOkaxYME1AeJ/U/dx74kYx7P3dwGGfeJJcAA=';

const BEFORE_SRC = '/landing/before.webp';
const AFTER_SRC = '/landing/after.webp';

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * Marketing before/after slider with WebP + blur-up placeholders.
 * Pointer + keyboard; fires `before_after_interact` once per session open.
 */
export const LandingBeforeAfter: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(52);
  const [sharp, setSharp] = useState(false);
  const dragging = useRef(false);
  const tracked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([preload(BEFORE_SRC), preload(AFTER_SRC)]).then(() => {
      if (!cancelled) setSharp(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markInteract = useCallback(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackCta('before_after_interact');
  }, []);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = ((clientX - rect.left) / rect.width) * 100;
      setPct(Math.max(0, Math.min(100, next)));
      markInteract();
    },
    [markInteract]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPct((p) => Math.max(0, p - 3));
      markInteract();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPct((p) => Math.min(100, p + 3));
      markInteract();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPct(0);
      markInteract();
    } else if (e.key === 'End') {
      e.preventDefault();
      setPct(100);
      markInteract();
    }
  };

  return (
    <section className="landing__compare" aria-labelledby="landing-compare-title">
      <div className="landing__compare-copy">
        <p className="landing__caps-label font-mono-ui">Before / After · drag</p>
        <h2 id="landing-compare-title" className="landing__bench-title font-display">
          Pull the plate. See the grade.
        </h2>
        <p className="landing__sub">
          Real product shot — dull capture vs. a quick PixelLite pass. Drag the divider or use
          arrow keys.
        </p>
      </div>

      <div
        ref={rootRef}
        className={`landing__ba${sharp ? ' is-sharp' : ''}`}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Before and after comparison"
        data-cta="before_after_slider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div
          className="landing__ba-layer landing__ba-before"
          style={{
            backgroundImage: `url(${sharp ? BEFORE_SRC : BEFORE_LQIP})`,
          }}
          aria-hidden
        />
        <div
          className="landing__ba-layer landing__ba-after"
          style={{
            backgroundImage: `url(${sharp ? AFTER_SRC : AFTER_LQIP})`,
            clipPath: `inset(0 ${100 - pct}% 0 0)`,
          }}
          aria-hidden
        />
        <span className="landing__ba-label landing__ba-label--before font-mono-ui">BEFORE</span>
        <span className="landing__ba-label landing__ba-label--after font-mono-ui">AFTER</span>
        <div className="landing__ba-handle" style={{ left: `${pct}%` }} aria-hidden>
          <span className="landing__ba-knob">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 9h8M5 9l-2-2M5 9l-2 2M13 9l2-2M13 9l2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
};
