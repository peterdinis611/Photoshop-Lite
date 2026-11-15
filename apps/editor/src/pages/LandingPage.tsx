import React, { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const DEFAULT_TITLE =
  'PhotoshopLite — Free Browser Photo Editor | Layers, AI Cutout & Revive';

const CAPABILITIES = [
  {
    index: '01',
    name: 'Layers',
    line: 'Blend modes, masks, smart objects and a full history — stacked like glass plates.',
  },
  {
    index: '02',
    name: 'Neural Lab',
    line: 'Cutout, Revive, Clarity, Outpaint. Runs in your browser; cloud jobs when you want more.',
  },
  {
    index: '03',
    name: 'Stock & CC',
    line: 'Pull free-licence photos straight onto the canvas, then save projects to the cloud.',
  },
] as const;

/** Marketing entry — industrial darkroom, safelight copper on deep ink. */
export const LandingPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'PhotoshopLite — Browser darkroom for layers, AI & export';
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, []);

  // Safelight follows the pointer — cheap CSS-var update, no re-render.
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--lx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--ly', `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  return (
    <div ref={rootRef} className="landing" onPointerMove={handlePointerMove}>
      <div className="landing__mesh" aria-hidden />
      <div className="landing__beam" aria-hidden />
      <div className="landing__safelight" aria-hidden />
      <div className="landing__grain" aria-hidden />

      <section className="landing__hero">
        <header className="landing__top">
          <span className="landing__mark" aria-hidden>
            Ps
          </span>
          <span className="landing__top-meta font-mono-ui">DARKROOM / BROWSER BUILD</span>
          <span className="landing__top-meta landing__top-meta--right font-mono-ui">
            FRAME 01 · 36
          </span>
        </header>

        <div className="landing__body">
          <p className="landing__kicker font-mono-ui">
            <span className="landing__kicker-dot" aria-hidden />
            Safelight on
          </p>

          <h1 className="landing__brand font-display">
            <span className="landing__brand-row landing__brand-row--a">Photoshop</span>
            <span className="landing__brand-row landing__brand-row--b">
              <em>Lite</em>
              <i className="landing__brand-rule" aria-hidden />
            </span>
          </h1>

          <div className="landing__lede">
            <p className="landing__headline font-display">
              Develop photos in the browser.
            </p>
            <p className="landing__sub">
              Layers, retouch and AI — no install, no upload required.
            </p>
            <Link to="/editor" className="landing__cta">
              <span>Open editor</span>
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        <footer className="landing__scroll font-mono-ui" aria-hidden>
          <span>Scroll</span>
          <i />
        </footer>

        <span className="landing__reg landing__reg--tl" aria-hidden />
        <span className="landing__reg landing__reg--br" aria-hidden />
      </section>

      <section className="landing__caps" aria-label="Capabilities">
        <p className="landing__caps-label font-mono-ui">On the bench</p>
        <ul className="landing__caps-list">
          {CAPABILITIES.map((c) => (
            <li key={c.name} className="landing__cap">
              <span className="landing__cap-index font-mono-ui">{c.index}</span>
              <span className="landing__cap-name font-display">{c.name}</span>
              <span className="landing__cap-line">{c.line}</span>
            </li>
          ))}
        </ul>

        <div className="landing__outro">
          <Link to="/editor" className="landing__cta landing__cta--ghost">
            <span>Open editor</span>
            <ArrowUpRight size={18} strokeWidth={2.4} />
          </Link>
          <span className="landing__legal font-mono-ui">PhotoshopLite · local-first</span>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
